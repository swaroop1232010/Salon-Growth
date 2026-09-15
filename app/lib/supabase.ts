import { createClient } from "@supabase/supabase-js";
import { Lead, DbLead, LeadStatus, Service, DbOffer, OfferPolicy } from "../types";
import { SERVICES } from "./services";

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
 * Checks whether a phone number has already claimed an offer.
 * Supports both 'new_customers_only' and 'once_per_campaign' policies.
 * Calls the check_phone_claimed RPC function in Supabase if installed.
 */
export async function checkPhoneClaimed(
  phone: string,
  campaign: string = "first-visit-special",
  policy: OfferPolicy = "new_customers_only"
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return false;

  try {
    const { data, error } = await supabasePublic.rpc("check_phone_claimed", {
      p_phone: digits,
      p_campaign: campaign,
      p_policy: policy,
    });
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
 * Prevents multiple claims with the same phone number according to offer policy.
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
  policy?: OfferPolicy;
  status?: LeadStatus;
}): Promise<Lead> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Check .env.local for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  const cleanPhone = leadData.phone.replace(/\D/g, "").slice(-10);
  const campaign = leadData.campaign || "first-visit-special";
  const policy = leadData.policy || "new_customers_only";

  // Proactive check if phone was already claimed for this policy/campaign
  const isAlreadyClaimed = await checkPhoneClaimed(cleanPhone, campaign, policy);
  if (isAlreadyClaimed) {
    const msg = policy === "once_per_campaign"
      ? "This mobile number has already claimed this campaign offer. Only 1 claim allowed per campaign."
      : "This mobile number has already claimed this offer. Only 1 offer is allowed per customer.";
    throw new Error(msg);
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
 * Supports updating by primary key UUID (dbId) or reference_id.
 * Falls back to RPC update_lead_status if direct update encounters permission/matching issues.
 */
export async function updateLeadStatus(
  idOrRef: string,
  status: LeadStatus,
  dbId?: string
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const targetId = dbId || idOrRef;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);

  // 1. Try updating by UUID primary key (if UUID)
  if (isUuid) {
    const { data, error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", targetId)
      .select("id, status");

    if (!error && data && data.length > 0) return;
  }

  // 2. Try updating by reference_id
  const refTarget = idOrRef || targetId;
  const { data: refData, error: refError } = await supabase
    .from("leads")
    .update({ status })
    .eq("reference_id", refTarget)
    .select("id, status");

  if (!refError && refData && refData.length > 0) return;

  // 3. Fallback: try RPC function (SECURITY DEFINER)
  try {
    const { data: rpcSuccess, error: rpcError } = await supabase.rpc("update_lead_status", {
      p_id: targetId,
      p_status: status,
    });
    if (!rpcError && rpcSuccess) return;
  } catch {
    // RPC not installed yet, proceed to throw clear error
  }

  if (refError) throw new Error(refError.message);
  throw new Error("Could not update lead status. Please verify your permissions or run the latest database schema.");
}

/**
 * Marks a lead as Completed with actual visit date and collected bill amount.
 * Requires authenticated session (RLS: "auth_update_leads" policy).
 */
export async function completeLeadVisit(
  idOrRef: string,
  actualVisitDate: string,
  billAmount: number,
  dbId?: string
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const targetId = dbId || idOrRef;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
  const updatePayload = {
    status: "Completed",
    actual_visit_date: toPostgresDate(actualVisitDate),
    bill_amount: billAmount,
  };

  if (isUuid) {
    const { data, error } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("id", targetId)
      .select("id");
    if (!error && data && data.length > 0) return;
  }

  const { data: refData, error: refError } = await supabase
    .from("leads")
    .update(updatePayload)
    .eq("reference_id", idOrRef)
    .select("id");

  if (!refError && refData && refData.length > 0) return;

  if (refError) throw new Error(refError.message);
  throw new Error("Could not complete lead visit. Please verify lead ID.");
}

/**
 * Marks a lead's follow-up as sent and records the timestamp.
 * Requires authenticated session (RLS: "auth_update_leads" policy).
 */
export async function markLeadFollowUpSent(idOrRef: string, dbId?: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const targetId = dbId || idOrRef;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
  const updatePayload = {
    status: "Follow-up Sent",
    follow_up_sent_at: new Date().toISOString(),
  };

  if (isUuid) {
    const { data, error } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("id", targetId)
      .select("id");
    if (!error && data && data.length > 0) return;
  }

  const { data: refData, error: refError } = await supabase
    .from("leads")
    .update(updatePayload)
    .eq("reference_id", idOrRef)
    .select("id");

  if (!refError && refData && refData.length > 0) return;

  if (refError) throw new Error(refError.message);
  throw new Error("Could not mark follow up as sent.");
}

// ─── Offer Operations (Admin Managed) ────────────────────────────────────────

/**
 * Maps a Supabase public.offers row to the Service UI model.
 */
export function fromDbOffer(row: DbOffer): Service {
  return {
    id: row.id,
    campaignSlug: row.campaign_slug,
    name: row.name,
    price: Number(row.price),
    offerPrice: Number(row.offer_price),
    discountAmount: Number(row.discount_amount),
    subtitle: row.subtitle || undefined,
    icon: row.icon || "scissors",
    badge: row.badge || undefined,
    bonusOffer: row.bonus_offer || undefined,
    isSpecial: row.is_special,
    policy: row.policy || "new_customers_only",
    isActive: row.is_active,
    displayOrder: row.display_order,
  };
}

/**
 * Fetches active offers for the landing page.
 * Uses supabasePublic to avoid auth conflicts.
 * Falls back to built-in SERVICES if table is not yet seeded or offline.
 */
export async function fetchActiveOffers(): Promise<Service[]> {
  if (!isSupabaseConfigured) return SERVICES;

  try {
    const { data, error } = await supabasePublic
      .from("offers")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return (data as DbOffer[]).map(fromDbOffer);
    }
  } catch {
    // Graceful fallback to static defaults
  }
  return SERVICES;
}

/**
 * Fetches all offers (active + inactive) for the staff dashboard.
 * Requires authenticated session.
 */
export async function fetchAllOffersForAdmin(): Promise<Service[]> {
  if (!isSupabaseConfigured) return SERVICES;

  try {
    const { data, error } = await supabase
      .from("offers")
      .select("*")
      .order("display_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return (data as DbOffer[]).map(fromDbOffer);
    }
  } catch {
    // Graceful fallback to static defaults
  }
  return SERVICES;
}

/**
 * Updates an offer in public.offers.
 * Requires authenticated session.
 */
export async function updateOffer(id: string, updates: Partial<Service>): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.price !== undefined) payload.price = Number(updates.price);
  if (updates.offerPrice !== undefined) payload.offer_price = Number(updates.offerPrice);
  if (updates.discountAmount !== undefined) payload.discount_amount = Number(updates.discountAmount);
  if (updates.subtitle !== undefined) payload.subtitle = updates.subtitle?.trim() || null;
  if (updates.icon !== undefined) payload.icon = updates.icon;
  if (updates.badge !== undefined) payload.badge = updates.badge || null;
  if (updates.bonusOffer !== undefined) payload.bonus_offer = updates.bonusOffer || null;
  if (updates.isSpecial !== undefined) payload.is_special = updates.isSpecial;
  if (updates.policy !== undefined) payload.policy = updates.policy;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;
  if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;
  if (updates.campaignSlug !== undefined) payload.campaign_slug = updates.campaignSlug;

  const { error } = await supabase.from("offers").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Creates a new offer in public.offers.
 * Requires authenticated session.
 */
export async function createOffer(offer: Omit<Service, "id">): Promise<Service> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const payload = {
    campaign_slug: offer.campaignSlug || "first-visit-special",
    name: offer.name.trim(),
    price: Number(offer.price),
    offer_price: Number(offer.offerPrice ?? Math.max(0, offer.price - (offer.discountAmount ?? 200))),
    discount_amount: Number(offer.discountAmount ?? 200),
    subtitle: offer.subtitle?.trim() || null,
    icon: offer.icon || "scissors",
    badge: offer.badge || null,
    bonus_offer: offer.bonusOffer || null,
    is_special: Boolean(offer.isSpecial),
    policy: offer.policy || "new_customers_only",
    is_active: offer.isActive !== undefined ? offer.isActive : true,
    display_order: offer.displayOrder ?? 99,
  };

  const { data, error } = await supabase.from("offers").insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return fromDbOffer(data as DbOffer);
}

/**
 * Deletes an offer by ID from public.offers.
 * Requires authenticated session.
 */
export async function deleteOffer(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("offers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

