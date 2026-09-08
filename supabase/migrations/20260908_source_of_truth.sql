-- Supabase source-of-truth hardening for the investment platform.
-- Apply after the existing schema/fix scripts.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (is_admin = true OR role = 'admin')
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  subtitle TEXT,
  category TEXT NOT NULL,
  minimum_investment NUMERIC(20,2) NOT NULL CHECK (minimum_investment > 0),
  maximum_investment NUMERIC(20,2),
  expected_return NUMERIC(20,6) NOT NULL DEFAULT 0,
  duration INTEGER,
  risk_level TEXT,
  currency TEXT NOT NULL DEFAULT 'UGX',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  image_url TEXT,
  daily_reward_ugx NUMERIC(20,2) NOT NULL DEFAULT 0,
  hashrate TEXT,
  power_source TEXT,
  uptime TEXT,
  temperature TEXT,
  efficiency NUMERIC(10,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (maximum_investment IS NULL OR maximum_investment >= minimum_investment)
);

CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id),
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'UGX',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'matured', 'cancelled', 'rejected')),
  start_date TIMESTAMPTZ,
  maturity_date TIMESTAMPTZ,
  expected_return NUMERIC(20,6) NOT NULL DEFAULT 0,
  actual_return NUMERIC(20,6),
  reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES public.investments(id) ON DELETE SET NULL,
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'UGX',
  payment_method TEXT,
  provider TEXT,
  provider_reference TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'successful', 'failed', 'cancelled', 'refunded')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES public.investments(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  previous_state JSONB,
  new_state JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investments_user_id_idx ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS investments_product_id_idx ON public.investments(product_id);
CREATE INDEX IF NOT EXISTS investments_status_idx ON public.investments(status);
CREATE INDEX IF NOT EXISTS investments_created_at_idx ON public.investments(created_at DESC);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_investment_id_idx ON public.payments(investment_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments(status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS approvals_user_id_idx ON public.approvals(user_id);
CREATE INDEX IF NOT EXISTS approvals_status_idx ON public.approvals(status);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs(entity_type, entity_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_read_active ON public.products;
CREATE POLICY products_read_active ON public.products
  FOR SELECT TO authenticated
  USING (status = 'active' OR public.is_admin());
DROP POLICY IF EXISTS products_admin_write ON public.products;
CREATE POLICY products_admin_write ON public.products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS investments_owner_read ON public.investments;
CREATE POLICY investments_owner_read ON public.investments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS investments_owner_insert ON public.investments;
CREATE POLICY investments_owner_insert ON public.investments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS investments_admin_update ON public.investments;
CREATE POLICY investments_admin_update ON public.investments
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS payments_owner_read ON public.payments;
CREATE POLICY payments_owner_read ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS payments_owner_insert ON public.payments;
CREATE POLICY payments_owner_insert ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
DROP POLICY IF EXISTS payments_admin_update ON public.payments;
CREATE POLICY payments_admin_update ON public.payments
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS approvals_owner_read ON public.approvals;
CREATE POLICY approvals_owner_read ON public.approvals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS approvals_admin_write ON public.approvals;
CREATE POLICY approvals_admin_write ON public.approvals
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS audit_admin_read ON public.audit_logs;
CREATE POLICY audit_admin_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS audit_server_insert ON public.audit_logs;
CREATE POLICY audit_server_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor = auth.uid() OR public.is_admin());

-- Existing legacy catalog must never be writable by ordinary users.
DROP POLICY IF EXISTS "Admins can manage catalog machines" ON public.catalog_machines;
DROP POLICY IF EXISTS catalog_all ON public.catalog_machines;
CREATE POLICY catalog_admin_write ON public.catalog_machines
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Keep the legacy catalog available only as a migration source. New application
-- code should use public.products for product identity and configuration.
INSERT INTO public.products (
  id, name, slug, description, category, minimum_investment, expected_return,
  currency, status, image_url, daily_reward_ugx, hashrate, power_source,
  uptime, temperature, efficiency
)
SELECT
  cm.id,
  cm.title,
  cm.id,
  cm.subtitle,
  cm.category,
  cm.min_invest_ugx,
  cm.est_yearly_roi,
  'UGX',
  CASE WHEN cm.status = 'Active' THEN 'active' ELSE 'inactive' END,
  cm.image,
  cm.daily_reward_ugx,
  cm.hashrate,
  cm.power_source,
  cm.uptime,
  cm.temperature,
  cm.efficiency
FROM public.catalog_machines cm
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_set_updated_at ON public.products;
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS investments_set_updated_at ON public.investments;
CREATE TRIGGER investments_set_updated_at BEFORE UPDATE ON public.investments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS payments_set_updated_at ON public.payments;
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS approvals_set_updated_at ON public.approvals;
CREATE TRIGGER approvals_set_updated_at BEFORE UPDATE ON public.approvals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
