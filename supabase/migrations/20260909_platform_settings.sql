-- Centralized platform configuration and product-specific investment minimums.
-- Apply after the existing schema/fix migrations.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS minimum_investment_amount NUMERIC(20,2);

UPDATE public.products
SET minimum_investment_amount = COALESCE(NULLIF(minimum_investment_amount, 0), minimum_investment)
WHERE minimum_investment_amount IS NULL OR minimum_investment_amount <= 0;

UPDATE public.products
SET minimum_investment_amount = 15000
WHERE minimum_investment_amount IS NULL OR minimum_investment_amount <= 0;

ALTER TABLE public.products
  ALTER COLUMN minimum_investment_amount SET NOT NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_minimum_investment_amount_positive;
ALTER TABLE public.products
  ADD CONSTRAINT products_minimum_investment_amount_positive
  CHECK (minimum_investment_amount > 0);

-- Keep the legacy column synchronized for older consumers during migration.
CREATE OR REPLACE FUNCTION public.sync_product_minimum_investment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.minimum_investment := NEW.minimum_investment_amount;
  ELSIF NEW.minimum_investment_amount IS DISTINCT FROM OLD.minimum_investment_amount THEN
    NEW.minimum_investment := NEW.minimum_investment_amount;
  ELSIF NEW.minimum_investment IS DISTINCT FROM OLD.minimum_investment THEN
    NEW.minimum_investment_amount := NEW.minimum_investment;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_sync_minimum_investment ON public.products;
CREATE TRIGGER products_sync_minimum_investment
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_product_minimum_investment();

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  numeric_value NUMERIC(20,6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_numeric_value_valid CHECK (numeric_value >= 0)
);

INSERT INTO public.platform_settings (key, numeric_value)
VALUES
  ('referral_percentage', 15),
  ('minimum_withdrawal_amount', 5000)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_settings_read_authenticated ON public.platform_settings;
CREATE POLICY platform_settings_read_authenticated ON public.platform_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS platform_settings_admin_write ON public.platform_settings;
CREATE POLICY platform_settings_admin_write ON public.platform_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Authoritative RPC: get_referral_percent()
CREATE OR REPLACE FUNCTION public.get_referral_percent()
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT numeric_value FROM public.platform_settings WHERE key = 'referral_percentage'),
    15
  );
$$;

REVOKE ALL ON FUNCTION public.get_referral_percent() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_referral_percent() TO authenticated;

-- Authoritative RPC: admin_update_referral_percent(p_percent numeric)
CREATE OR REPLACE FUNCTION public.admin_update_referral_percent(
  p_percent NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_percent IS NULL OR p_percent < 0 OR p_percent > 100 THEN
    RAISE EXCEPTION 'Referral percentage must be between 0 and 100';
  END IF;

  INSERT INTO public.platform_settings (key, numeric_value, updated_at)
  VALUES ('referral_percentage', p_percent, now())
  ON CONFLICT (key) DO UPDATE
    SET numeric_value = EXCLUDED.numeric_value,
        updated_at = now();

  RETURN p_percent;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_referral_percent(NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_referral_percent(NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_settings()
RETURNS TABLE (key TEXT, numeric_value NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.key, s.numeric_value
  FROM public.platform_settings s
  ORDER BY s.key;
$$;

REVOKE ALL ON FUNCTION public.get_platform_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_platform_setting(
  p_key TEXT,
  p_numeric_value NUMERIC
)
RETURNS TABLE (key TEXT, numeric_value NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_key NOT IN ('referral_percentage', 'minimum_withdrawal_amount') THEN
    RAISE EXCEPTION 'Unsupported platform setting';
  END IF;
  IF p_numeric_value IS NULL OR p_numeric_value < 0 THEN
    RAISE EXCEPTION 'Setting value must not be negative';
  END IF;
  IF p_key = 'referral_percentage' AND p_numeric_value > 100 THEN
    RAISE EXCEPTION 'Referral percentage must be between 0 and 100';
  END IF;
  IF p_key = 'minimum_withdrawal_amount' AND p_numeric_value <= 0 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount must be greater than zero';
  END IF;

  INSERT INTO public.platform_settings (key, numeric_value, updated_at)
  VALUES (p_key, p_numeric_value, now())
  ON CONFLICT (key) DO UPDATE
    SET numeric_value = EXCLUDED.numeric_value, updated_at = now();

  RETURN QUERY SELECT s.key, s.numeric_value
  FROM public.platform_settings s WHERE s.key = p_key;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_platform_setting(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_platform_setting(TEXT, NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_product_minimum(
  p_product_id TEXT,
  p_minimum NUMERIC
)
RETURNS public.products
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_product public.products;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_minimum IS NULL OR p_minimum <= 0 THEN
    RAISE EXCEPTION 'Minimum investment amount must be greater than zero';
  END IF;

  UPDATE public.products
  SET minimum_investment_amount = p_minimum,
      minimum_investment = p_minimum,
      updated_at = now()
  WHERE id = p_product_id
  RETURNING * INTO v_product;

  IF NOT FOUND THEN RAISE EXCEPTION 'Investment product not found'; END IF;
  RETURN v_product;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_product_minimum(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_product_minimum(TEXT, NUMERIC) TO authenticated;

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
  v_min_withdrawal NUMERIC;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND status = 'blocked') THEN
    RAISE EXCEPTION 'Account is blocked';
  END IF;
  IF p_type NOT IN ('deposit', 'withdraw') THEN RAISE EXCEPTION 'Invalid transaction type'; END IF;
  IF p_amount_ugx IS NULL OR p_amount_ugx <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;

  SELECT numeric_value INTO v_min_withdrawal
  FROM public.platform_settings WHERE key = 'minimum_withdrawal_amount';
  IF p_type = 'withdraw' AND p_amount_ugx < COALESCE(v_min_withdrawal, 5000) THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is UGX %.', COALESCE(v_min_withdrawal, 5000);
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF p_type = 'withdraw' THEN
    IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    IF p_amount_ugx > v_wallet.total_balance_ugx THEN
      RAISE EXCEPTION 'Insufficient balance: requested %, available %', p_amount_ugx, v_wallet.total_balance_ugx;
    END IF;
  END IF;

  v_id := 'tx_' || lower(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 18));
  INSERT INTO public.transactions (
    id, user_id, type, amount_ugx, currency, status,
    description, payment_method, recipient_info, timestamp, created_at
  ) VALUES (
    v_id, v_uid, p_type, p_amount_ugx, 'UGX', 'pending',
    COALESCE(p_description, p_type || ' Request - UGX ' || p_amount_ugx::text),
    p_payment_method, p_recipient_info, now(), now()
  ) RETURNING * INTO v_res;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_transaction(TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_transaction(TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

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
  v_balance NUMERIC;
  v_user_machine_id TEXT;
  v_tx_id TEXT;
  v_product public.products;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount_ugx IS NULL OR p_amount_ugx <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND status = 'blocked') THEN
    RAISE EXCEPTION 'Account is blocked. Investment purchases are disabled.';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_machine_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment product not found'; END IF;
  IF p_amount_ugx < v_product.minimum_investment_amount THEN
    RAISE EXCEPTION 'Minimum investment for this product is UGX %.', v_product.minimum_investment_amount;
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
  INSERT INTO public.user_machines (
    id, user_id, machine_id, title, category, image, daily_reward_ugx, status,
    est_yearly_roi, min_invest_ugx, amount_invested_ugx, hashrate, power_source,
    total_mined_ugx, unclaimed_rewards_ugx, is_boosted, created_at, updated_at
  ) VALUES (
    v_user_machine_id, v_uid, p_machine_id,
    v_product.name, v_product.category, v_product.image_url,
    COALESCE(p_daily_reward_ugx, v_product.daily_reward_ugx), 'Active',
    COALESCE(p_est_roi, v_product.expected_return), p_amount_ugx, p_amount_ugx,
    COALESCE(p_hashrate, v_product.hashrate), COALESCE(p_power_source, v_product.power_source),
    0, 0, false, now(), now()
  );

  v_tx_id := 'tx_' || lower(substring(replace(gen_random_uuid()::text,'-','') from 1 for 18));
  INSERT INTO public.transactions (id, user_id, type, amount_ugx, currency, status, description, is_credit, timestamp, created_at)
  VALUES (v_tx_id, v_uid, 'investment', p_amount_ugx, 'UGX', 'completed',
    'Deployed Investment Node: ' || v_product.name, false, now(), now());

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance,
    'user_machine_id', v_user_machine_id, 'transaction_id', v_tx_id);
END;
$$;

REVOKE ALL ON FUNCTION public.buy_investment(TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_investment(TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,NUMERIC) TO authenticated;
