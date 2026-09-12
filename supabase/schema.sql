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

-- RLS Configuration for Phase 1
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert and select for leads"
ON public.leads
FOR ALL
USING (true)
WITH CHECK (true);
