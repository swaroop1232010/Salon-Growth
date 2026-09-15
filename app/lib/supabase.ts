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

// Supabase client — uses publishable/anon key only (never service-role key)
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder"
);

// Dedicated unauthenticated client for public customer lead capture
// Ensures staff auth sessions never leak into public customer submissions
export const supabasePublic = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/** Returns the current authenticated session, or null if not logged in. */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Signs in a staff user with email and password. Throws on failure. */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.session;
}

/** Signs out the current staff user. Throws on failure. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

// ─── Date Utilities ───────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Normalizes any date string (ISO or "15 Sep 2026") to Postgres DATE "YYYY-MM-DD".
 */
export function toPostgresDate(dateStr?: string | null): string | null {
  if (!dateStr || dateStr.trim() === "-" || dateStr.trim() === "") return null;
  const s = dateStr.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const parts = s.split(" ");
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const mIdx = MONTHS.indexOf(parts[1]);
    const year = parts[2];
    if (mIdx !== -1 && /^\d{4}$/.test(year)) {
      return `${year}-${String(mIdx + 1).padStart(2, "0")}-${day}`;
    }
  }

  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  } catch {
    // unparseable — fall through to null
  }
  return null;
}

/**
 * Maps a Supabase database row (public.leads) to the UI Lead model.
 */
export function fromDbLead(row: DbLead): Lead {
  return {
    id:             row.reference_id || row.id,
    dbId:           row.id,
    referenceId:    row.reference_id,
    name:           row.name,
    phone:          row.phone,
    service:        row.service,
    regularPrice:   row.regular_price   !== null ? Number(row.regular_price)   : undefined,
    offerPrice:     row.offer_price     !== null ? Number(row.offer_price)     : undefined,
    discountAmount: row.discount_amount !== null ? Number(row.discount_amount) : undefined,
    preferredDate:  row.preferred_date  || "-",
    preferredTime:  row.preferred_time  || "",
    source:         row.source          || "Direct",
    medium:         row.medium          || "",
    campaign:       row.campaign        || "",
    status:         row.status,
    createdAt:      row.created_at,
    actualVisitDate: row.actual_visit_date || undefined,
    billAmount:     row.bill_amount !== null && row.bill_amount !== undefined
                      ? Number(row.bill_amount) : undefined,
    followUpSentAt: row.follow_up_sent_at || undefined,
  };
}

// ─── Reference ID Generator ───────────────────────────────────────────────────

/**
 * Returns the next sequential reference ID (e.g. SGS-007).
 *
 * Anonymous users cannot SELECT leads due to RLS — this falls back to a
 * timestamp-based ID so lead insertion from the landing page still works.
 */
export async function getNextReferenceId(): Promise<string> {
  // Generates a collision-resistant sequential timestamp reference ID (e.g. SGS-894231)
  return `SGS-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
}

// ─── Lead Operations ──────────────────────────────────────────────────────────

/**
 * Checks whether a phone number has already claimed a first-visit offer.
 * Calls the check_phone_claimed RPC function in Supabase if installed.
 */
export async function checkPhoneClaimed(phone: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return false;

  try {
    const { data, error } = await supabasePublic.rpc("check_phone_claimed", { p_phone: digits });
    if (!error && typeof data === "boolean") {
      return data;
    }
  } catch {
    // Graceful fallback if RPC function is not yet created
  }
  return false;
}

/**
 * Inserts a new lead into public.leads.
 * Uses supabasePublic to guarantee execution under anonymous role without staff session conflicts.
 * Prevents multiple claims with the same phone number.
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
    throw new Error("Supabase is not configured. Check .env.local for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  const cleanPhone = leadData.phone.replace(/\D/g, "").slice(-10);

  // Proactive check if phone was already claimed
  const isAlreadyClaimed = await checkPhoneClaimed(cleanPhone);
  if (isAlreadyClaimed) {
    throw new Error("This mobile number has already claimed this offer. Only 1 offer is allowed per customer.");
  }

  let refId = await getNextReferenceId();

  const payload = {
    reference_id:   refId,
    name:           leadData.name.trim(),
    phone:          cleanPhone,
    service:        leadData.service,
    regular_price:  leadData.regularPrice,
    offer_price:    leadData.offerPrice,
    discount_amount: leadData.discountAmount,
    preferred_date: toPostgresDate(leadData.preferredDate),
    preferred_time: leadData.preferredTime,
    source:         leadData.source   || "Direct",
    medium:         leadData.medium   || "",
    campaign:       leadData.campaign || "",
    status:         leadData.status   || "Booking Requested",
  };

  let { error } = await supabasePublic.from("leads").insert([payload]);

  // Unique constraint violation (23505)
  if (error && error.code === "23505") {
    const errorDetails = ((error.message || "") + " " + (error.details || "")).toLowerCase();
    if (errorDetails.includes("phone")) {
      throw new Error("This mobile number has already claimed this offer. Only 1 offer is allowed per customer.");
    }

    // Otherwise reference_id collision — retry once with a fresh random ID
    payload.reference_id = `SGS-${Date.now().toString().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
    const retry = await supabasePublic.from("leads").insert([payload]);
    error = retry.error;
    if (error && error.code === "23505") {
      throw new Error("This mobile number has already claimed this offer. Only 1 offer is allowed per customer.");
    }
  }

  if (error) {
    throw new Error(error.message || "Failed to insert lead.");
  }

  return {
    id: payload.reference_id,
    referenceId: payload.reference_id,
    name: payload.name,
    phone: payload.phone,
    service: payload.service,
    regularPrice: payload.regular_price,
    offerPrice: payload.offer_price,
    discountAmount: payload.discount_amount,
    preferredDate: leadData.preferredDate || "-",
    preferredTime: payload.preferred_time,
    source: payload.source,
    medium: payload.medium,
    campaign: payload.campaign,
    status: payload.status as LeadStatus,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Fetches all leads sorted newest-first.
 * Requires authenticated session (RLS: "auth_select_leads" policy).
 */
export async function fetchLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data || []) as DbLead[]).map(fromDbLead);
}

/**
 * Updates the status of a lead.
 * Requires authenticated session (RLS: "auth_update_leads" policy).
 */
export async function updateLeadStatus(idOrRef: string, status: LeadStatus): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrRef);
  const { error } = isUuid
    ? await supabase.from("leads").update({ status }).eq("id", idOrRef)
    : await supabase.from("leads").update({ status }).eq("reference_id", idOrRef);

  if (error) throw new Error(error.message);
}

/**
 * Marks a lead as Completed with actual visit date and collected bill amount.
 * Requires authenticated session (RLS: "auth_update_leads" policy).
 */
export async function completeLeadVisit(
  idOrRef: string,
  actualVisitDate: string,
  billAmount: number
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrRef);
  const update = { status: "Completed", actual_visit_date: toPostgresDate(actualVisitDate), bill_amount: billAmount };
  const { error } = isUuid
    ? await supabase.from("leads").update(update).eq("id", idOrRef)
    : await supabase.from("leads").update(update).eq("reference_id", idOrRef);

  if (error) throw new Error(error.message);
}

/**
 * Marks a lead's follow-up as sent and records the timestamp.
 * Requires authenticated session (RLS: "auth_update_leads" policy).
 */
export async function markLeadFollowUpSent(idOrRef: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrRef);
  const update = { status: "Follow-up Sent", follow_up_sent_at: new Date().toISOString() };
  const { error } = isUuid
    ? await supabase.from("leads").update(update).eq("id", idOrRef)
    : await supabase.from("leads").update(update).eq("reference_id", idOrRef);

  if (error) throw new Error(error.message);
}
