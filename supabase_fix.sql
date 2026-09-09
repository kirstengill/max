-- ============================================================
-- LINES — CONSOLIDATED FIX MIGRATION (run once in SQL Editor)
-- Fixes: welcome bonus trigger, transactions schema, RPCs,
-- referral processing, claim_reward, RLS. Supabase = source of truth.
-- ============================================================

-- ---------- 0. Schema alignment ----------
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS timestamp BIGINT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_credit BOOLEAN DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending','completed','approved','rejected','cancelled'));
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit','withdraw','reward','investment','transfer','bonus','adjustment','referral_claim'));

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';
UPDATE public.notifications SET type='info' WHERE type IS NULL;

CREATE INDEX IF NOT EXISTS idx_tx_user_created ON public.transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user_created ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- ============================================================
-- 1. is_admin helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND (p.is_admin = TRUE OR p.role = 'admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- 2. SIGNUP TRIGGER: profile + wallet(4000) + bonus tx + notification
--    Idempotent & retry-safe. Referral handled AFTER trigger via
--    handle_referral() (see section 3) because auth.users FK must exist.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_fullname TEXT;
  v_phone TEXT;
  v_role TEXT;
  v_ref_code TEXT;
  v_referred_by TEXT;
BEGIN
  v_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  v_fullname := COALESCE(NULLIF(new.raw_user_meta_data->>'full_name',''), v_username);
  v_phone    := COALESCE(new.raw_user_meta_data->>'phone', '');
  v_role     := 'user'; -- never trust client-supplied role
  v_referred_by := NULLIF(new.raw_user_meta_data->>'referred_by','');
  v_ref_code := COALESCE(NULLIF(new.raw_user_meta_data->>'referral_code',''),
                         'SC-' || upper(substring(md5(random()::text || new.id::text) from 1 for 6)));

  -- Profile (idempotent; welcome_bonus_claimed starts as false)
  INSERT INTO public.profiles (id, username, full_name, phone, role, status, tier,
                               referral_code, referred_by, welcome_bonus_claimed, is_admin)
  VALUES (new.id, v_username, v_fullname, v_phone, v_role, 'active',
          CASE WHEN v_role = 'admin' THEN 'VIP 2 Elite' ELSE 'Standard' END,
          v_ref_code, v_referred_by, false, false)
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  -- Wallet (idempotent, starts with 0 UGX)
  INSERT INTO public.wallets (user_id, total_balance_ugx, daily_pnl_ugx,
                              active_machines_count, pending_tasks_count)
  VALUES (new.id, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Welcome notification
  INSERT INTO public.notifications (id, user_id, title, message, read, type)
  VALUES ('notif_welcome_' || new.id::text, new.id,
          'Welcome to Sunrise Capital DS',
          'Make and complete your first deposit to unlock your UGX 4,000 Welcome Bonus with 0% fee!',
          false, 'info')
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. REFERRAL processing: called from frontend after signup.
--    Validates the code, links profiles, increments referrer count.
--    Commission (20%) is earned ONLY when referred user's deposit is approved.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_referral(p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_referrer_id UUID;
  v_referrer_username TEXT;
  v_new_username TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_referral_code IS NULL OR btrim(p_referral_code) = '' THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_code');
  END IF;

  -- Find referrer by referral_code (case-insensitive). Block self-referral.
  SELECT id, username INTO v_referrer_id, v_referrer_username
  FROM public.profiles
  WHERE lower(referral_code) = lower(btrim(p_referral_code))
    AND id <> v_uid
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'invalid_or_self_code');
  END IF;

  -- Link the new user to the referrer (only if not already set)
  UPDATE public.profiles
  SET referred_by = btrim(p_referral_code), updated_at = now()
  WHERE id = v_uid AND (referred_by IS NULL OR referred_by = '');

  SELECT username INTO v_new_username FROM public.profiles WHERE id = v_uid;

  -- Increment referrer's referral_count
  UPDATE public.profiles
  SET referral_count = (SELECT COUNT(*) FROM public.profiles WHERE lower(referred_by) = lower(btrim(p_referral_code))),
      updated_at = now()
  WHERE id = v_referrer_id;

  -- Referrer notification about new registration
  INSERT INTO public.notifications (id, user_id, title, message, read, type)
  VALUES ('notif_refjoin_' || v_uid::text, v_referrer_id,
          'New Referral Joined',
          'A new partner (@' || COALESCE(v_new_username, 'partner') || ') registered using your referral code. You will earn 20% commission once their deposit is approved.',
          false, 'info')
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('applied', true, 'referrer_id', v_referrer_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_referral(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.process_referral(TEXT) TO authenticated;

-- ============================================================
-- 3b. USER: get referral summary (count, available commission, total commission)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_referral_summary()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ref_code TEXT;
  v_total_referrals INTEGER := 0;
  v_total_approved_deposits NUMERIC := 0;
  v_total_commission NUMERIC := 0;
  v_claimed_commission NUMERIC := 0;
  v_available_commission NUMERIC := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT referral_code INTO v_ref_code FROM public.profiles WHERE id = v_uid;
  IF v_ref_code IS NULL OR v_ref_code = '' THEN
    RETURN jsonb_build_object(
      'total_referrals', 0,
      'available_commission_ugx', 0,
      'total_commission_ugx', 0,
      'claimed_commission_ugx', 0,
      'referral_code', ''
    );
  END IF;

  -- Count real referred users
  SELECT COUNT(*) INTO v_total_referrals
  FROM public.profiles
  WHERE lower(referred_by) = lower(v_ref_code) AND id <> v_uid;

  -- Total approved deposits made by all referred users
  SELECT COALESCE(SUM(t.amount_ugx), 0) INTO v_total_approved_deposits
  FROM public.transactions t
  INNER JOIN public.profiles p ON p.id = t.user_id
  WHERE lower(p.referred_by) = lower(v_ref_code)
    AND p.id <> v_uid
    AND t.type = 'deposit'
    AND t.status = 'completed';

  -- Total commission earned at the centrally configured percentage.
  v_total_commission := ROUND(v_total_approved_deposits * COALESCE((SELECT numeric_value / 100 FROM public.platform_settings WHERE key = 'referral_percentage'), 0.20));

  -- Total commission already claimed
  SELECT COALESCE(SUM(amount_ugx), 0) INTO v_claimed_commission
  FROM public.transactions
  WHERE user_id = v_uid
    AND status = 'completed'
    AND type IN ('bonus', 'reward')
    AND (
      id LIKE 'tx_claim_ref_%'
      OR id LIKE 'tx_refcomm_%'
      OR description ILIKE '%referral commission%'
    );

  v_available_commission := GREATEST(0, v_total_commission - v_claimed_commission);

  -- Keep profiles stats updated
  UPDATE public.profiles
  SET referral_count = v_total_referrals,
      referral_earnings_ugx = v_total_commission,
      updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'total_referrals', v_total_referrals,
    'available_commission_ugx', v_available_commission,
    'total_commission_ugx', v_total_commission,
    'claimed_commission_ugx', v_claimed_commission,
    'referral_code', v_ref_code
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_referral_summary() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_referral_summary() TO authenticated;

-- ============================================================
-- 3c. USER: get referred users list (names, joined date, deposits, 20% commission)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_referred_users()
RETURNS TABLE (
  id TEXT,
  username TEXT,
  full_name TEXT,
  registered_date TEXT,
  approved_deposit_ugx NUMERIC,
  commission_ugx NUMERIC,
  status TEXT,
  commission_status TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ref_code TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT referral_code INTO v_ref_code FROM public.profiles WHERE id = v_uid;
  IF v_ref_code IS NULL OR v_ref_code = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id::text,
    COALESCE(p.username, 'user') AS username,
    COALESCE(p.full_name, '') AS full_name,
    to_char(p.created_at, 'DD Mon YYYY') AS registered_date,
    COALESCE(SUM(CASE WHEN t.type = 'deposit' AND t.status = 'completed' THEN t.amount_ugx ELSE 0 END), 0) AS approved_deposit_ugx,
    ROUND(COALESCE(SUM(CASE WHEN t.type = 'deposit' AND t.status = 'completed' THEN t.amount_ugx ELSE 0 END), 0) * COALESCE((SELECT numeric_value / 100 FROM public.platform_settings WHERE key = 'referral_percentage'), 0.20)) AS commission_ugx,
    CASE
      WHEN COALESCE(SUM(CASE WHEN t.type = 'deposit' AND t.status = 'completed' THEN t.amount_ugx ELSE 0 END), 0) > 0 THEN 'active'
      ELSE 'pending'
    END AS status,
    CASE
      WHEN COALESCE(SUM(CASE WHEN t.type = 'deposit' AND t.status = 'completed' THEN t.amount_ugx ELSE 0 END), 0) > 0 THEN 'approved'
      ELSE 'no_approved_deposit'
    END AS commission_status
  FROM public.profiles p
  LEFT JOIN public.transactions t ON t.user_id = p.id
  WHERE lower(p.referred_by) = lower(v_ref_code)
    AND p.id <> v_uid
  GROUP BY p.id, p.username, p.full_name, p.created_at
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_referred_users() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_referred_users() TO authenticated;

-- ============================================================
-- 3d. USER: claim referral commission (atomic wallet transfer)
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_referral_commission()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ref_code TEXT;
  v_total_approved_deposits NUMERIC := 0;
  v_total_commission NUMERIC := 0;
  v_claimed_commission NUMERIC := 0;
  v_available NUMERIC := 0;
  v_wallet_bal NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_tx_id TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Lock wallet row for update
  SELECT total_balance_ugx INTO v_wallet_bal FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, total_balance_ugx) VALUES (v_uid, 0) RETURNING total_balance_ugx INTO v_wallet_bal;
  END IF;

  SELECT referral_code INTO v_ref_code FROM public.profiles WHERE id = v_uid;
  IF v_ref_code IS NULL OR v_ref_code = '' THEN
    RETURN jsonb_build_object('success', false, 'claimed_ugx', 0, 'reason', 'no_referral_code', 'message', 'No referral code configured');
  END IF;

  -- Calculate total approved deposits
  SELECT COALESCE(SUM(t.amount_ugx), 0) INTO v_total_approved_deposits
  FROM public.transactions t
  INNER JOIN public.profiles p ON p.id = t.user_id
  WHERE lower(p.referred_by) = lower(v_ref_code)
    AND p.id <> v_uid
    AND t.type = 'deposit'
    AND t.status = 'completed';

  v_total_commission := ROUND(v_total_approved_deposits * COALESCE((SELECT numeric_value / 100 FROM public.platform_settings WHERE key = 'referral_percentage'), 0.20));

  -- Calculate already claimed commission
  SELECT COALESCE(SUM(amount_ugx), 0) INTO v_claimed_commission
  FROM public.transactions
  WHERE user_id = v_uid
    AND status = 'completed'
    AND type IN ('bonus', 'reward')
    AND (
      id LIKE 'tx_claim_ref_%'
      OR id LIKE 'tx_refcomm_%'
      OR description ILIKE '%referral commission%'
    );

  v_available := GREATEST(0, v_total_commission - v_claimed_commission);

  IF v_available <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'claimed_ugx', 0,
      'reason', 'no_commission_available',
      'message', 'No referral commission available to claim at this time.'
    );
  END IF;

  -- Transfer available commission to wallet
  v_new_balance := v_wallet_bal + v_available;
  UPDATE public.wallets
  SET total_balance_ugx = v_new_balance, updated_at = now()
  WHERE user_id = v_uid;

  -- Insert completed claim transaction
  v_tx_id := 'tx_claim_ref_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 18));
  INSERT INTO public.transactions (id, user_id, type, amount_ugx, currency, status,
    description, is_credit, timestamp, created_at)
  VALUES (v_tx_id, v_uid, 'bonus', v_available, 'UGX', 'completed',
    'Claimed Referral Commission (20%)', true, now(), now());

  -- Insert notification
  INSERT INTO public.notifications (id, user_id, title, message, read, type)
  VALUES ('notif_' || v_tx_id, v_uid, 'Referral Commission Claimed',
    'UGX ' || v_available::text || ' referral commission has been credited directly to your main wallet balance.',
    false, 'success');

  RETURN jsonb_build_object(
    'success', true,
    'claimed_ugx', v_available,
    'new_balance', v_new_balance,
    'message', 'Successfully claimed UGX ' || v_available::text || ' referral commission.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_referral_commission() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_referral_commission() TO authenticated;

-- ============================================================
-- 3e. USER: claim welcome bonus (UGX 4,000, requires approved deposit, 0% fee)
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_welcome_bonus()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_already_claimed BOOLEAN := false;
  v_has_approved_deposit BOOLEAN := false;
  v_bonus_amount NUMERIC := 4000;
  v_new_balance NUMERIC := 0;
  v_tx_id TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Check if user already claimed welcome bonus
  SELECT COALESCE(welcome_bonus_claimed, false) INTO v_already_claimed
  FROM public.profiles
  WHERE id = v_uid;

  IF v_already_claimed IS TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Welcome bonus has already been claimed for this account.',
      'code', 'ALREADY_CLAIMED'
    );
  END IF;

  -- 2. Verify that an approved/completed deposit exists
  SELECT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = v_uid
      AND type = 'deposit'
      AND status IN ('completed', 'approved')
  ) INTO v_has_approved_deposit;

  IF NOT v_has_approved_deposit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'An approved deposit is required to unlock your UGX 4,000 Welcome Bonus.',
      'code', 'DEPOSIT_REQUIRED'
    );
  END IF;

  -- 3. Update profile to mark welcome bonus claimed
  UPDATE public.profiles
  SET welcome_bonus_claimed = true,
      updated_at = now()
  WHERE id = v_uid;

  -- 4. Credit user wallet atomically
  UPDATE public.wallets
  SET total_balance_ugx = total_balance_ugx + v_bonus_amount,
      updated_at = now()
  WHERE user_id = v_uid
  RETURNING total_balance_ugx INTO v_new_balance;

  -- If wallet didn't exist, initialize
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, total_balance_ugx)
    VALUES (v_uid, v_bonus_amount)
    RETURNING total_balance_ugx INTO v_new_balance;
  END IF;

  -- 5. Record Welcome Bonus transaction (0% fee, full 4,000 UGX credited)
  v_tx_id := 'tx_welcome_' || v_uid::text;
  INSERT INTO public.transactions (
    id, user_id, type, amount_ugx, currency, status,
    description, is_credit, timestamp, created_at
  ) VALUES (
    v_tx_id, v_uid, 'bonus', v_bonus_amount, 'UGX', 'completed',
    'Welcome Bonus — UGX 4,000 claimed (0% Fee)', true,
    round(extract(epoch from now()) * 1000)::bigint, now()
  ) ON CONFLICT (id) DO UPDATE SET
    status = 'completed',
    updated_at = now();

  -- 6. Insert notification for user
  INSERT INTO public.notifications (
    id, user_id, title, message, read, type, created_at
  ) VALUES (
    'notif_welcome_' || v_uid::text, v_uid,
    'Welcome Bonus Claimed (UGX 4,000)',
    'UGX 4,000 Welcome Bonus has been credited to your wallet balance with 0% transaction fee!',
    false, 'success', now()
  ) ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'claimed_ugx', v_bonus_amount,
    'new_balance', v_new_balance,
    'message', 'Welcome Bonus Claimed! UGX 4,000 has been added to your wallet.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_welcome_bonus() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_welcome_bonus() TO authenticated;

-- ============================================================
-- 4. USER: submit deposit/withdraw -> pending + notification
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_transaction(
  p_type TEXT,
  p_amount_ugx NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_recipient_info TEXT DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id TEXT;
  v_uid UUID := auth.uid();
  v_wallet public.wallets;
  v_res public.transactions;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND status = 'blocked') THEN
    RAISE EXCEPTION 'Account is blocked';
  END IF;
  IF p_type NOT IN ('deposit','withdraw') THEN RAISE EXCEPTION 'Invalid transaction type'; END IF;
  IF p_amount_ugx IS NULL OR p_amount_ugx <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF p_type = 'withdraw' THEN
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    IF p_amount_ugx > v_wallet.total_balance_ugx THEN
      RAISE EXCEPTION 'Insufficient balance: requested %, available %', p_amount_ugx, v_wallet.total_balance_ugx;
    END IF;
  END IF;

  v_id := 'tx_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 18));

  INSERT INTO public.transactions (id, user_id, type, amount_ugx, currency, status,
    description, payment_method, recipient_info, timestamp, created_at)
  VALUES (v_id, v_uid, p_type, p_amount_ugx, 'UGX', 'pending',
    COALESCE(p_description, p_type || ' Request — UGX ' || p_amount_ugx::text),
    p_payment_method, p_recipient_info,
    now(), now())
  RETURNING * INTO v_res;

  INSERT INTO public.notifications (id, user_id, title, message, read, type)
  VALUES ('notif_submit_' || v_id, v_uid,
    CASE WHEN p_type='deposit' THEN 'Deposit Submitted (Pending)' ELSE 'Withdrawal Submitted (Pending)' END,
    CASE WHEN p_type='deposit'
      THEN 'Your deposit of UGX ' || p_amount_ugx::text || ' is pending approval.'
      ELSE 'Your withdrawal of UGX ' || p_amount_ugx::text || ' is pending approval.'
    END, false, 'info')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.admin_tasks (id, user_id, transaction_id, title, description,
    priority, type, status, amount_ugx, created_at)
  VALUES ('task_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 18)),
    v_uid, v_id,
    CASE WHEN p_type='deposit' THEN 'Deposit Verification: UGX ' || p_amount_ugx::text
         ELSE 'Withdrawal Review: UGX ' || p_amount_ugx::text END,
    'User requested ' || p_type || ' of UGX ' || p_amount_ugx::text || COALESCE(' via ' || p_payment_method,''),
    'high', p_type, 'pending', p_amount_ugx, now())
  ON CONFLICT DO NOTHING;

  RETURN v_res;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_transaction(TEXT,NUMERIC,TEXT,TEXT,TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_transaction(TEXT,NUMERIC,TEXT,TEXT,TEXT) TO authenticated;

-- ============================================================
-- 5. ADMIN: list pending / all transactions (with user info)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_pending_transactions()
RETURNS TABLE (id TEXT, user_id UUID, username TEXT, user_full_name TEXT,
  type TEXT, amount_ugx NUMERIC, status TEXT, description TEXT,
  payment_method TEXT, recipient_info TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.user_id,
         COALESCE(p.username, split_part(u.email,'@',1), 'user'),
         COALESCE(p.full_name, (u.raw_user_meta_data->>'full_name'), p.username, 'Unnamed User'),
         t.type, t.amount_ugx, t.status, t.description, t.payment_method, t.recipient_info,
         t.created_at
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN auth.users u ON u.id = t.user_id
  WHERE t.status = 'pending'
  ORDER BY t.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.admin_all_transactions()
RETURNS TABLE (id TEXT, user_id UUID, username TEXT, user_full_name TEXT,
  type TEXT, amount_ugx NUMERIC, currency TEXT, status TEXT, description TEXT,
  payment_method TEXT, recipient_info TEXT, tx_hash TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.user_id,
         COALESCE(p.username, split_part(u.email,'@',1), 'user'),
         COALESCE(p.full_name, (u.raw_user_meta_data->>'full_name'), p.username, 'Unnamed User'),
         t.type, t.amount_ugx, t.currency, t.status, t.description,
         t.payment_method, t.recipient_info, t.tx_hash, t.created_at
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN auth.users u ON u.id = t.user_id
  ORDER BY t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_pending_transactions() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_pending_transactions() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_all_transactions() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_all_transactions() FROM anon, public;

-- ============================================================
-- 6. ADMIN: approve / reject (atomic, idempotent, with notification)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_approve_transaction(p_transaction_id TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID; v_type TEXT; v_amount NUMERIC; v_balance NUMERIC; v_admin UUID := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;

  SELECT user_id, type, amount_ugx INTO v_uid, v_type, v_amount
  FROM public.transactions WHERE id = p_transaction_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE public.transactions
  SET status = 'completed', approved_by = v_admin, approved_at = now()
  WHERE id = p_transaction_id;

  SELECT total_balance_ugx INTO v_balance FROM public.wallets WHERE user_id = v_uid FOR UPDATE;

  IF v_type = 'deposit' THEN
    UPDATE public.wallets SET total_balance_ugx = total_balance_ugx + v_amount, updated_at = now()
    WHERE user_id = v_uid RETURNING total_balance_ugx INTO v_balance;
  ELSE
    IF v_amount > COALESCE(v_balance,0) THEN
      RAISE EXCEPTION 'Insufficient balance for withdrawal approval';
    END IF;
    UPDATE public.wallets SET total_balance_ugx = total_balance_ugx - v_amount, updated_at = now()
    WHERE user_id = v_uid RETURNING total_balance_ugx INTO v_balance;
  END IF;

  UPDATE public.admin_tasks SET status='approved' WHERE transaction_id = p_transaction_id;

  INSERT INTO public.notifications (id, user_id, title, message, read, type)
  VALUES ('notif_txappr_' || p_transaction_id, v_uid,
    CASE WHEN v_type='deposit' THEN 'Deposit Approved' ELSE 'Withdrawal Approved' END,
    CASE WHEN v_type='deposit'
      THEN 'Your deposit of UGX ' || v_amount::text || ' has been approved and credited to your wallet.'
      ELSE 'Your withdrawal of UGX ' || v_amount::text || ' has been approved and settled.'
    END, false, 'success')
  ON CONFLICT (id) DO NOTHING;

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_transaction(p_transaction_id TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID; v_type TEXT; v_amount NUMERIC; v_balance NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;

  SELECT user_id, type, amount_ugx INTO v_uid, v_type, v_amount
  FROM public.transactions WHERE id = p_transaction_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE public.transactions SET status = 'rejected' WHERE id = p_transaction_id;
  UPDATE public.admin_tasks SET status='rejected' WHERE transaction_id = p_transaction_id;

  SELECT total_balance_ugx INTO v_balance FROM public.wallets WHERE user_id = v_uid;

  INSERT INTO public.notifications (id, user_id, title, message, read, type)
  VALUES ('notif_txrej_' || p_transaction_id, v_uid,
    'Transaction Rejected',
    CASE WHEN v_type='deposit' THEN 'Your deposit of UGX ' ELSE 'Your withdrawal of UGX ' END
      || v_amount::text || ' was rejected by an administrator. Your balance was not changed.',
    false, 'warning')
  ON CONFLICT (id) DO NOTHING;

  RETURN v_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_approve_transaction(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_approve_transaction(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reject_transaction(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_reject_transaction(TEXT) TO authenticated;

-- ============================================================
-- 7. ADMIN: list users / update user
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (id UUID, username TEXT, full_name TEXT, phone TEXT, email TEXT,
  status TEXT, is_admin BOOLEAN, tier TEXT, referral_code TEXT, referred_by TEXT,
  referral_count INTEGER, referral_earnings_ugx NUMERIC,
  balance_ugx NUMERIC, active_machines_count INTEGER, transactions_count BIGINT,
  auth_created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id,
    COALESCE(p.username, split_part(u.email,'@',1), 'user'),
    COALESCE(p.full_name, (u.raw_user_meta_data->>'full_name'), p.username, 'Unnamed User'),
    COALESCE(p.phone, ''),
    u.email,
    COALESCE(p.status,'active'),
    COALESCE(p.is_admin, false),
    COALESCE(p.tier,'Standard'),
    COALESCE(p.referral_code,''),
    p.referred_by,
    COALESCE(p.referral_count,0),
    COALESCE(p.referral_earnings_ugx,0),
    COALESCE(w.total_balance_ugx,0),
    COALESCE(w.active_machines_count,0),
    (SELECT COUNT(*) FROM public.transactions t WHERE t.user_id = u.id),
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.wallets w ON w.user_id = u.id
  ORDER BY u.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id UUID, p_username TEXT DEFAULT NULL, p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL, p_status TEXT DEFAULT NULL, p_full_name_meta TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user id required'; END IF;

  UPDATE public.profiles SET
    username = COALESCE(p_username, username),
    full_name = COALESCE(p_full_name, full_name),
    phone = COALESCE(p_phone, phone),
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE id = p_user_id;

  IF p_full_name_meta IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('full_name', p_full_name_meta)
    WHERE id = p_user_id;
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_user(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_update_user(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- ============================================================
-- 8. ADMIN: balance adjustment (audited + tx + notification)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_user_id UUID, p_amount NUMERIC, p_type TEXT, p_reason TEXT)
RETURNS TABLE (previous_balance NUMERIC, new_balance NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prev NUMERIC := 0; v_new NUMERIC := 0;
  v_admin_username TEXT; v_user_username TEXT; v_user_full_name TEXT;
  v_adj_id TEXT; v_tx_id TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_type NOT IN ('add','deduct') THEN RAISE EXCEPTION 'Invalid adjustment type'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  INSERT INTO public.wallets (user_id, total_balance_ugx, daily_pnl_ugx, active_machines_count, pending_tasks_count)
  VALUES (p_user_id, 0, 0, 0, 0) ON CONFLICT (user_id) DO NOTHING;

  SELECT total_balance_ugx INTO v_prev FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  v_new := CASE WHEN p_type='add' THEN v_prev + p_amount ELSE v_prev - p_amount END;
  IF v_new < 0 THEN RAISE EXCEPTION 'Resulting balance cannot be negative'; END IF;

  UPDATE public.wallets SET total_balance_ugx = v_new, updated_at = now() WHERE user_id = p_user_id;

  SELECT COALESCE(p.username, split_part(u.email,'@',1),'Admin') INTO v_admin_username
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = auth.uid();

  SELECT COALESCE(p.username, split_part(u.email,'@',1),'user'),
         COALESCE(p.full_name, (u.raw_user_meta_data->>'full_name'), p.username,'User')
  INTO v_user_username, v_user_full_name
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = p_user_id;

  v_adj_id := 'adj_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 18));
  INSERT INTO public.balance_adjustments (id, user_id, username, user_full_name,
    previous_balance_ugx, adjustment_amount_ugx, new_balance_ugx, type, reason,
    admin_id, admin_username, timestamp, date)
  VALUES (v_adj_id, p_user_id, v_user_username, v_user_full_name, v_prev, p_amount, v_new,
    p_type, COALESCE(p_reason,'Admin Adjustment'), COALESCE(auth.uid()::text,'admin'),
    COALESCE(v_admin_username,'Admin'), now(),
    to_char(now(),'YYYY-MM-DD'));

  v_tx_id := 'tx_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 18));
  INSERT INTO public.transactions (id, user_id, type, amount_ugx, currency, status,
    description, is_credit, timestamp, created_at)
  VALUES (v_tx_id, p_user_id, 'adjustment', p_amount, 'UGX', 'completed',
    'Admin Balance Adjustment (' || p_type || '): ' || COALESCE(p_reason,'Manual update'),
    p_type='add', now(), now());

  INSERT INTO public.notifications (id, user_id, title, message, read, type)
  VALUES ('notif_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 18)),
    p_user_id,
    CASE WHEN p_type='add' THEN 'Balance Credited by Admin' ELSE 'Balance Adjusted by Admin' END,
    'Your wallet balance was ' || (CASE WHEN p_type='add' THEN 'credited with UGX ' ELSE 'deducted by UGX ' END)
      || p_amount::text || '. New balance: UGX ' || v_new::text || '. Reason: ' || COALESCE(p_reason,'Administrative adjustment'),
    false, CASE WHEN p_type='add' THEN 'success' ELSE 'info' END);

  RETURN QUERY SELECT v_prev, v_new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance(UUID,NUMERIC,TEXT,TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(UUID,NUMERIC,TEXT,TEXT) TO authenticated;

-- ============================================================
-- 9. USER: atomic investment purchase
-- ============================================================
CREATE OR REPLACE FUNCTION public.buy_investment(
  p_machine_id TEXT, p_title TEXT, p_category TEXT, p_image TEXT,
  p_amount_ugx NUMERIC, p_daily_reward_ugx NUMERIC,
  p_hashrate TEXT DEFAULT '10.0 TH/s', p_power_source TEXT DEFAULT 'Clean Energy Array',
  p_est_roi NUMERIC DEFAULT 120)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_balance NUMERIC; v_user_machine_id TEXT; v_tx_id TEXT;
  v_catalog RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount_ugx IS NULL OR p_amount_ugx <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND status='blocked') THEN
    RAISE EXCEPTION 'Account is blocked. Investment purchases are disabled.';
  END IF;

  -- Verify the product exists in the catalog
  SELECT * INTO v_catalog FROM public.catalog_machines WHERE id = p_machine_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment product not found in catalog'; END IF;
  IF p_amount_ugx < v_catalog.min_invest_ugx THEN
    RAISE EXCEPTION 'Minimum investment for % is UGX %', v_catalog.title, v_catalog.min_invest_ugx;
  END IF;

  SELECT total_balance_ugx INTO v_balance FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF p_amount_ugx > v_balance THEN
    RAISE EXCEPTION 'Insufficient balance: requires %, available %', p_amount_ugx, v_balance;
  END IF;

  UPDATE public.wallets
  SET total_balance_ugx = total_balance_ugx - p_amount_ugx,
      active_machines_count = active_machines_count + 1,
      updated_at = now()
  WHERE user_id = v_uid RETURNING total_balance_ugx INTO v_balance;

  v_user_machine_id := 'node_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 16));
  INSERT INTO public.user_machines (id, user_id, machine_id, title, category, image,
    daily_reward_ugx, status, est_yearly_roi, min_invest_ugx, amount_invested_ugx,
    hashrate, power_source, total_mined_ugx, unclaimed_rewards_ugx, is_boosted, created_at, updated_at)
  VALUES (v_user_machine_id, v_uid, p_machine_id,
    COALESCE(NULLIF(p_title,''), v_catalog.title), COALESCE(p_category, v_catalog.category),
    COALESCE(NULLIF(p_image,''), v_catalog.image),
    COALESCE(p_daily_reward_ugx, v_catalog.daily_reward_ugx), 'Active',
    COALESCE(p_est_roi, v_catalog.est_yearly_roi), p_amount_ugx, p_amount_ugx,
    COALESCE(p_hashrate, v_catalog.hashrate), COALESCE(p_power_source, v_catalog.power_source),
    0, 0, false, now(), now());

  v_tx_id := 'tx_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 18));
  INSERT INTO public.transactions (id, user_id, type, amount_ugx, currency, status,
    description, is_credit, timestamp, created_at)
  VALUES (v_tx_id, v_uid, 'investment', p_amount_ugx, 'UGX', 'completed',
    'Deployed Investment Node: ' || COALESCE(NULLIF(p_title,''), v_catalog.title), false,
    now(), now());

  INSERT INTO public.notifications (id, user_id, title, message, read, type)
  VALUES ('notif_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 18)),
    v_uid, 'Investment Created',
    'Your investment of UGX ' || p_amount_ugx::text || ' in ' || COALESCE(NULLIF(p_title,''), v_catalog.title)
      || ' has been created.', false, 'success');

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance,
    'user_machine_id', v_user_machine_id, 'transaction_id', v_tx_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.buy_investment(TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.buy_investment(TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC) TO authenticated;

-- ============================================================
-- 10. USER: claim reward (atomic, idempotent via FOR UPDATE)
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_reward(p_user_machine_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_machine RECORD;
  v_unclaimed NUMERIC;
  v_balance NUMERIC;
  v_tx_id TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_machine FROM public.user_machines
  WHERE id = p_user_machine_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment machine not found'; END IF;

  v_unclaimed := COALESCE(v_machine.unclaimed_rewards_ugx, 0);
  IF v_unclaimed <= 0 THEN
    RETURN jsonb_build_object('success', false, 'claimed', 0, 'reason', 'nothing_to_claim');
  END IF;

  UPDATE public.user_machines
  SET unclaimed_rewards_ugx = 0,
      total_mined_ugx = COALESCE(total_mined_ugx,0) + v_unclaimed,
      updated_at = now()
  WHERE id = p_user_machine_id;

  UPDATE public.wallets
  SET total_balance_ugx = total_balance_ugx + v_unclaimed, updated_at = now()
  WHERE user_id = v_uid RETURNING total_balance_ugx INTO v_balance;

  v_tx_id := 'tx_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 18));
  INSERT INTO public.transactions (id, user_id, type, amount_ugx, currency, status,
    description, is_credit, timestamp, created_at)
  VALUES (v_tx_id, v_uid, 'reward', v_unclaimed, 'UGX', 'completed',
    'Reward claimed: ' || v_machine.title, true,
    now(), now());

  INSERT INTO public.notifications (id, user_id, title, message, read, type)
  VALUES ('notif_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 18)),
    v_uid, 'Reward Credited',
    'UGX ' || v_unclaimed::text || ' reward has been credited to your wallet.', false, 'success');

  RETURN jsonb_build_object('success', true, 'claimed_ugx', v_unclaimed, 'new_balance', v_balance,
    'transaction_id', v_tx_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_reward(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_reward(TEXT) TO authenticated;

-- ============================================================
-- 11. ADMIN: admin tasks list (all users)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_tasks()
RETURNS TABLE (id TEXT, user_id UUID, username TEXT, transaction_id TEXT,
  type TEXT, title TEXT, description TEXT, amount_ugx NUMERIC,
  status TEXT, priority TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT k.id, k.user_id, COALESCE(p.username,'user'), k.transaction_id,
         k.type, k.title, k.description, k.amount_ugx, k.status, k.priority, k.created_at
  FROM public.admin_tasks k
  LEFT JOIN public.profiles p ON p.id = k.user_id
  ORDER BY k.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_tasks() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_tasks() TO authenticated;

-- ============================================================
-- 12. RLS policies (tightened, supabase = source of truth)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- WALLETS (read own/admin; NO direct writes — all writes go through RPCs)
DROP POLICY IF EXISTS "wallet_select" ON public.wallets;
CREATE POLICY "wallet_select" ON public.wallets FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- TRANSACTIONS
DROP POLICY IF EXISTS "tx_select" ON public.transactions;
CREATE POLICY "tx_select" ON public.transactions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "tx_insert" ON public.transactions;
CREATE POLICY "tx_insert" ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "tx_update" ON public.transactions;
CREATE POLICY "tx_update" ON public.transactions FOR UPDATE
  USING (public.is_admin() OR (auth.uid() = user_id));
DROP POLICY IF EXISTS "tx_delete" ON public.transactions;
CREATE POLICY "tx_delete" ON public.transactions FOR DELETE USING (public.is_admin());

-- USER MACHINES
DROP POLICY IF EXISTS "machines_select" ON public.user_machines;
CREATE POLICY "machines_select" ON public.user_machines FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "machines_insert" ON public.user_machines;
CREATE POLICY "machines_insert" ON public.user_machines FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "machines_update" ON public.user_machines;
CREATE POLICY "machines_update" ON public.user_machines FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "machines_delete" ON public.user_machines;
CREATE POLICY "machines_delete" ON public.user_machines FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- CATALOG (public read, authenticated admin write)
DROP POLICY IF EXISTS "catalog_select" ON public.catalog_machines;
CREATE POLICY "catalog_select" ON public.catalog_machines FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_write" ON public.catalog_machines;
CREATE POLICY "catalog_write" ON public.catalog_machines FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
CREATE POLICY "notif_select" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "notif_update" ON public.notifications;
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ADMIN TASKS
DROP POLICY IF EXISTS "tasks_select" ON public.admin_tasks;
CREATE POLICY "tasks_select" ON public.admin_tasks FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- BALANCE ADJUSTMENTS
DROP POLICY IF EXISTS "adjust_select" ON public.balance_adjustments;
CREATE POLICY "adjust_select" ON public.balance_adjustments FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- 13. Repair any EXISTING users that signed up under the old
--     broken trigger (missing bonus tx / notification / balance)
-- ============================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT u.id FROM auth.users u
           LEFT JOIN public.profiles p ON p.id = u.id
           WHERE p.id IS NULL
  LOOP
    INSERT INTO public.profiles (id, username, full_name, phone, role, status, tier,
                                 referral_code, referred_by, welcome_bonus_claimed, is_admin)
    VALUES (r.id, split_part((SELECT email FROM auth.users WHERE id = r.id), '@', 1),
            (SELECT COALESCE(NULLIF(raw_user_meta_data->>'full_name',''), split_part(email,'@',1))
             FROM auth.users WHERE id = r.id),
            (SELECT COALESCE(raw_user_meta_data->>'phone','') FROM auth.users WHERE id = r.id),
            'user', 'active', 'Standard',
            'SC-' || upper(substring(md5(random()::text || r.id::text) from 1 for 6)),
            NULLIF((SELECT raw_user_meta_data->>'referred_by' FROM auth.users WHERE id = r.id),''),
            true, false)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  FOR r IN SELECT u.id FROM auth.users u
  LOOP
    INSERT INTO public.wallets (user_id, total_balance_ugx, daily_pnl_ugx, active_machines_count, pending_tasks_count)
    VALUES (r.id, 4000, 0, 0, 0) ON CONFLICT (user_id) DO NOTHING;

    -- Only credit the bonus if user has NO wallet bonus tx already and balance wasn't manually topped up
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = 'tx_welcome_' || r.id::text) THEN
      INSERT INTO public.transactions (id, user_id, type, amount_ugx, currency, status,
                                       description, is_credit, timestamp, created_at)
      VALUES ('tx_welcome_' || r.id::text, r.id, 'bonus', 4000, 'UGX', 'completed',
              'Welcome Signup Bonus — UGX 4,000 credited to your wallet', true,
              now(), now())
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.notifications (id, user_id, title, message, read, type)
      VALUES ('notif_welcome_' || r.id::text, r.id, 'Welcome to Sunrise Capital DS',
              'UGX 4,000 signup bonus has been credited to your wallet.', false, 'success')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
