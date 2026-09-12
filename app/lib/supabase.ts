import { createClient } from "@supabase/supabase-js";
import { Lead, DbLead, LeadStatus } from "../types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("your-project-id") &&
  !supabaseAnonKey.includes("your-supabase-anon")
);

// Create Supabase client
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder"
);

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Normalizes any date string (ISO or "15 Sep 2026") into a Postgres DATE format "YYYY-MM-DD".
 */
export function toPostgresDate(dateStr?: string | null): string | null {
  if (!dateStr || dateStr.trim() === "-" || dateStr.trim() === "") return null;
  const s = dateStr.trim();
  
  // Check if already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Check if "15 Sep 2026" format
  const parts = s.split(" ");
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const mIdx = MONTHS.indexOf(parts[1]);
    const year = parts[2];
    if (mIdx !== -1 && /^\d{4}$/.test(year)) {
      const month = String(mIdx + 1).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  // Fallback to JS date parse
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Maps a database row from public.leads to the UI Lead model.
 */
export function fromDbLead(row: DbLead): Lead {
  return {
    id: row.reference_id || row.id,
    dbId: row.id,
    referenceId: row.reference_id,
    name: row.name,
    phone: row.phone,
    service: row.service,
    regularPrice: row.regular_price !== null ? Number(row.regular_price) : undefined,
    offerPrice: row.offer_price !== null ? Number(row.offer_price) : undefined,
    discountAmount: row.discount_amount !== null ? Number(row.discount_amount) : undefined,
    preferredDate: row.preferred_date || "-",
    preferredTime: row.preferred_time || "",
    source: row.source || "Direct",
    medium: row.medium || "",
    campaign: row.campaign || "",
    status: row.status,
    createdAt: row.created_at,
    actualVisitDate: row.actual_visit_date || undefined,
    billAmount: row.bill_amount !== null && row.bill_amount !== undefined ? Number(row.bill_amount) : undefined,
    followUpSentAt: row.follow_up_sent_at || undefined,
  };
}

/**
 * Safe, collision-resistant next reference ID generator from Supabase.
 * Generates sequential SGS-001, SGS-002, SGS-003 without relying on LocalStorage.
 */
export async function getNextReferenceId(): Promise<string> {
  if (!isSupabaseConfigured) {
    // Fallback if Supabase is not yet configured with real credentials
    return `SGS-${String(Math.floor(Math.random() * 900) + 100)}`;
  }

  try {
    const { data, error } = await supabase
      .from("leads")
      .select("reference_id")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data || data.length === 0) {
      return "SGS-001";
    }

    let maxNum = 0;
    for (const row of data) {
      if (row.reference_id) {
        const match = row.reference_id.match(/SGS-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    const nextNum = maxNum + 1;
    return `SGS-${String(nextNum).padStart(3, "0")}`;
  } catch (err) {
    console.error("Error generating reference id from Supabase:", err);
    return `SGS-${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Inserts a new lead into Supabase public.leads table.
 */
export async function insertLead(leadData: {
  name: string;
  phone: string;
  service: string;
  regularPrice: number;
  offerPrice: number;
  discountAmount: number;
  preferredDate: string;
  preferredTime: string;
  source: string;
  medium: string;
  campaign: string;
  status?: LeadStatus;
}): Promise<Lead> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.");
  }

  let refId = await getNextReferenceId();

  const insertPayload = {
    reference_id: refId,
    name: leadData.name.trim(),
    phone: leadData.phone.trim(),
    service: leadData.service,
    regular_price: leadData.regularPrice,
    offer_price: leadData.offerPrice,
    discount_amount: leadData.discountAmount,
    preferred_date: toPostgresDate(leadData.preferredDate),
    preferred_time: leadData.preferredTime,
    source: leadData.source || "Direct",
    medium: leadData.medium || "",
    campaign: leadData.campaign || "",
    status: leadData.status || "Booking Requested",
  };

  let { data, error } = await supabase
    .from("leads")
    .insert([insertPayload])
    .select()
    .single();

  // Retry once with incremented ID if unique constraint violation occurs
  if (error && error.code === "23505") {
    const fallbackNum = Math.floor(Math.random() * 9000) + 1000;
    refId = `SGS-${fallbackNum}`;
    insertPayload.reference_id = refId;
    const retryResult = await supabase
      .from("leads")
      .insert([insertPayload])
      .select()
      .single();
    data = retryResult.data;
    error = retryResult.error;
  }

  if (error || !data) {
    console.error(
      "Supabase insert lead error:",
      error?.message || "Unknown error",
      `[Code: ${error?.code || "none"}]`,
      error?.details ? `Details: ${error.details}` : "",
      error?.hint ? `Hint: ${error.hint}` : ""
    );
    if (error?.code === "42501") {
      console.warn(
        "Row Level Security (RLS) Policy Error: Please run the RLS policy in Supabase SQL Editor: CREATE POLICY \"Allow anon insert and select for leads\" ON public.leads FOR ALL USING (true) WITH CHECK (true);"
      );
    }
    throw new Error(error?.message || "Failed to insert lead into Supabase.");
  }

  return fromDbLead(data as DbLead);
}

/**
 * Fetches all leads from Supabase public.leads, sorted newest first.
 */
export async function fetchLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetch leads error:", error);
    throw new Error(error.message);
  }

  return ((data || []) as DbLead[]).map(fromDbLead);
}

/**
 * Updates status of a lead in Supabase.
 */
export async function updateLeadStatus(idOrRef: string, status: LeadStatus): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  // Update either by UUID id or reference_id
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrRef);
  const query = supabase.from("leads").update({ status });
  const { error } = isUuid
    ? await query.eq("id", idOrRef)
    : await query.eq("reference_id", idOrRef);

  if (error) {
    console.error("Supabase update status error:", error);
    throw new Error(error.message);
  }
}

/**
 * Completes a lead with actual visit date and collected bill amount.
 */
export async function completeLeadVisit(
  idOrRef: string,
  actualVisitDate: string,
  billAmount: number
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrRef);
  const pgDate = toPostgresDate(actualVisitDate);
  const query = supabase.from("leads").update({
    status: "Completed",
    actual_visit_date: pgDate,
    bill_amount: billAmount,
  });

  const { error } = isUuid
    ? await query.eq("id", idOrRef)
    : await query.eq("reference_id", idOrRef);

  if (error) {
    console.error("Supabase complete visit error:", error);
    throw new Error(error.message);
  }
}

/**
 * Marks follow-up as sent and records timestamp.
 */
export async function markLeadFollowUpSent(idOrRef: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrRef);
  const query = supabase.from("leads").update({
    status: "Follow-up Sent",
    follow_up_sent_at: new Date().toISOString(),
  });

  const { error } = isUuid
    ? await query.eq("id", idOrRef)
    : await query.eq("reference_id", idOrRef);

  if (error) {
    console.error("Supabase mark follow up sent error:", error);
    throw new Error(error.message);
  }
}
