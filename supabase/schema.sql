-- ============================================================
-- SALON GROWTH SYSTEM — SUPABASE SCHEMA
-- Table: public.leads
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service TEXT NOT NULL,
  regular_price NUMERIC,
  offer_price NUMERIC,
  discount_amount NUMERIC DEFAULT 200,
  preferred_date DATE,
  preferred_time TEXT,
  source TEXT DEFAULT 'Direct',
  medium TEXT DEFAULT '',
  campaign TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Booking Requested',
  actual_visit_date DATE,
  bill_amount NUMERIC,
  follow_up_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON public.leads (campaign);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads (phone);

-- Auto-update updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_leads_updated_at ON public.leads;
CREATE TRIGGER set_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- RLS Configuration — Phase 2 (Secure)
-- ============================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop Phase 1 unrestricted policy (if it exists)
DROP POLICY IF EXISTS "Allow anon insert and select for leads" ON public.leads;

-- Anonymous users (landing page visitors): INSERT only
-- This allows the lead capture form to work without authentication.
CREATE POLICY "anon_insert_leads"
ON public.leads
FOR INSERT
TO anon
WITH CHECK (true);

-- Authenticated salon staff: SELECT all leads
CREATE POLICY "auth_select_leads"
ON public.leads
FOR SELECT
TO authenticated
USING (true);

-- Authenticated salon staff: UPDATE leads
-- Covers status changes, bill amounts, follow-up timestamps.
DROP POLICY IF EXISTS "auth_update_leads" ON public.leads;
CREATE POLICY "auth_update_leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- No DELETE policy — nobody can delete leads.

-- Dedicated RPC function for updating lead status safely
CREATE OR REPLACE FUNCTION public.update_lead_status(
  p_id TEXT,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Try updating by UUID primary key
  IF p_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    UPDATE public.leads 
    SET status = p_status, updated_at = now() 
    WHERE id = p_id::UUID;
    IF FOUND THEN RETURN true; END IF;
  END IF;

  -- 2. Try updating by reference_id
  UPDATE public.leads 
  SET status = p_status, updated_at = now() 
  WHERE reference_id = p_id;
  IF FOUND THEN RETURN true; END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_lead_status(TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- Phone Uniqueness & Duplicate Offer Prevention
-- ============================================================

-- Enforce 1 offer per customer (Unique phone number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone_unique ON public.leads (phone);

-- Function to check if a phone number has already claimed an offer (safe for anon callers)
-- Supports both 'new_customers_only' (1-time ever) and 'once_per_campaign' (1-time per promotion)
CREATE OR REPLACE FUNCTION public.check_phone_claimed(
  p_phone TEXT,
  p_campaign TEXT DEFAULT 'first-visit-special',
  p_policy TEXT DEFAULT 'new_customers_only'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_policy = 'once_per_campaign' THEN
    -- Returning customers can claim, but only once per specific campaign
    RETURN EXISTS (
      SELECT 1 FROM public.leads 
      WHERE phone = p_phone 
        AND (campaign = p_campaign OR (p_campaign IS NULL AND (campaign IS NULL OR campaign = '')))
    );
  ELSE
    -- Default 'new_customers_only': phone cannot exist anywhere in leads
    RETURN EXISTS (
      SELECT 1 FROM public.leads WHERE phone = p_phone
    );
  END IF;
END;
$$;

-- Grant execution to anon and authenticated callers
GRANT EXECUTE ON FUNCTION public.check_phone_claimed(TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- Table: public.offers (Admin-Managed Offers & Combos)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_slug TEXT NOT NULL DEFAULT 'first-visit-special',
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  offer_price NUMERIC NOT NULL,
  discount_amount NUMERIC NOT NULL DEFAULT 200,
  subtitle TEXT,
  icon TEXT NOT NULL DEFAULT 'scissors',
  badge TEXT,
  bonus_offer TEXT,
  is_special BOOLEAN NOT NULL DEFAULT false,
  policy TEXT NOT NULL DEFAULT 'new_customers_only', -- 'new_customers_only' | 'once_per_campaign'
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for ordering active offers on landing page
CREATE INDEX IF NOT EXISTS idx_offers_active_order ON public.offers (is_active, display_order);

-- Auto-update updated_at trigger for offers
DROP TRIGGER IF EXISTS set_offers_updated_at ON public.offers;
CREATE TRIGGER set_offers_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- RLS Configuration for offers
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Anonymous and authenticated visitors can view active offers
CREATE POLICY "anon_select_active_offers"
ON public.offers
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Authenticated staff can view all offers (active + inactive)
CREATE POLICY "auth_select_all_offers"
ON public.offers
FOR SELECT
TO authenticated
USING (true);

-- Authenticated staff can create, update, and delete offers
CREATE POLICY "auth_manage_offers"
ON public.offers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- Seed Initial Offers (Safe insert if empty)
-- ============================================================

INSERT INTO public.offers (campaign_slug, name, price, offer_price, discount_amount, subtitle, icon, badge, bonus_offer, is_special, policy, is_active, display_order)
SELECT 'first-visit-special', 'Advanced Haircut', 899, 699, 200, 'incl. Hairwash', 'scissors', 'Save ₹200', NULL, false, 'new_customers_only', true, 1
WHERE NOT EXISTS (SELECT 1 FROM public.offers WHERE name = 'Advanced Haircut');

INSERT INTO public.offers (campaign_slug, name, price, offer_price, discount_amount, subtitle, icon, badge, bonus_offer, is_special, policy, is_active, display_order)
SELECT 'first-visit-special', 'Fruit Facial + Face D-Tan', 1299, 1099, 200, 'Glow combo', 'facial', 'Save ₹200', NULL, false, 'new_customers_only', true, 2
WHERE NOT EXISTS (SELECT 1 FROM public.offers WHERE name = 'Fruit Facial + Face D-Tan');

INSERT INTO public.offers (campaign_slug, name, price, offer_price, discount_amount, subtitle, icon, badge, bonus_offer, is_special, policy, is_active, display_order)
SELECT 'first-visit-special', 'Basic Pedi + Mani', 999, 799, 200, 'Hands & Feet care', 'nails', 'Save ₹200', NULL, false, 'new_customers_only', true, 3
WHERE NOT EXISTS (SELECT 1 FROM public.offers WHERE name = 'Basic Pedi + Mani');

INSERT INTO public.offers (campaign_slug, name, price, offer_price, discount_amount, subtitle, icon, badge, bonus_offer, is_special, policy, is_active, display_order)
SELECT 'first-visit-special', 'Full Hands + Half Legs Waxing', 899, 699, 200, 'Smooth finish', 'waxing', 'Save ₹200', NULL, false, 'new_customers_only', true, 4
WHERE NOT EXISTS (SELECT 1 FROM public.offers WHERE name = 'Full Hands + Half Legs Waxing');

INSERT INTO public.offers (campaign_slug, name, price, offer_price, discount_amount, subtitle, icon, badge, bonus_offer, is_special, policy, is_active, display_order)
SELECT 'first-visit-special', 'Students flat 40% + 10% review on all services', 1000, 500, 500, 'Flat 40% with Student ID + Extra 10% on Google Review', 'student', 'Flat 40% + 10% OFF', '+10% on Google Review', true, 'once_per_campaign', true, 5
WHERE NOT EXISTS (SELECT 1 FROM public.offers WHERE is_special = true);

-- ============================================================
