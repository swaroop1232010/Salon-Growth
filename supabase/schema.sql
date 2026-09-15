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
CREATE POLICY "auth_update_leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- No DELETE policy — nobody can delete leads.

-- ============================================================
-- Phone Uniqueness & Duplicate Offer Prevention
-- ============================================================

-- Enforce 1 offer per customer (Unique phone number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone_unique ON public.leads (phone);

-- Function to check if a phone number has already claimed an offer (safe for anon callers)
CREATE OR REPLACE FUNCTION public.check_phone_claimed(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.leads WHERE phone = p_phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_phone_claimed(TEXT) TO anon, authenticated;
-- ============================================================
