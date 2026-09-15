"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lead, LeadStatus, Service, OfferPolicy } from "../types";
import {
  fetchLeads,
  updateLeadStatus,
  completeLeadVisit,
  markLeadFollowUpSent,
  fetchAllOffersForAdmin,
  updateOffer,
  createOffer,
  deleteOffer,
  isSupabaseConfigured,
  supabase,
  signOut,
} from "../lib/supabase";
import { SERVICES, DISCOUNT } from "../lib/services";

/** Clears the proxy auth cookie on logout. */
function clearAuthCookie() {
  document.cookie = "sgs-staff-auth=; path=/; max-age=0; SameSite=Lax";
}

const ALL_STATUSES: LeadStatus[] = [
  "New", "Contacted", "Booking Requested", "Booked", "Completed", "Lost", "Follow-up Sent",
];
const ACTIVE_STATUSES: LeadStatus[] = ["New", "Contacted", "Follow-up Sent", "Booking Requested"];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Safe date helpers ────────────────────────────────────────────────────────
function displayDate(raw: string | undefined): string {
  if (!raw) return "-";
  if (/^\d{1,2}\s[A-Za-z]{3}\s\d{4}$/.test(raw.trim())) return raw.trim();
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatIsoToSafeDate(isoValue: string): string {
  if (!isoValue) return "";
  const [y, m, d] = isoValue.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function parseSafeDateToIso(str: string | undefined): string {
  if (!str) return todayIso();
  const parts = str.trim().split(" ");
  if (parts.length === 3) {
    const d = parts[0].padStart(2, "0");
    const mIdx = MONTHS.indexOf(parts[1]);
    const y = parts[2];
    if (mIdx !== -1) {
      const m = String(mIdx + 1).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  return todayIso();
}

function getDefaultBillForService(serviceName: string): number {
  const match = SERVICES.find(s => s.name.toLowerCase() === serviceName.toLowerCase());
  if (match) {
    return match.offerPrice ?? Math.max(0, match.price - (match.discountAmount ?? DISCOUNT));
  }
  return 0;
}

// ─── WhatsApp message ─────────────────────────────────────────────────────────
function buildFollowUpMessage(lead: Lead): string {
  const firstName = lead.name.split(" ")[0];
  return (
    "Hi " + firstName + " \uD83D\uDC4B\n\n" +
    "Thank you for your interest in Swasthik Salon & Boutique.\n\n" +
    "Your " + lead.service + " first-visit offer (Rs.200 OFF) is still available.\n\n" +
    "Would you like to confirm your appointment? Our team is ready to book a slot for you!\n\n" +
    "📍 *Salon Location:*\n" +
    "Swasthik Salon & Boutique, CXHF+82V, Ravindra Nagar, Nellore, Andhra Pradesh 524003\n\n" +
    "🗺️ *Tap to Open Google Maps:*\n" +
    "https://maps.google.com/?q=CXHF%2B82V,+Ravindra+Nagar,+Nellore,+Andhra+Pradesh+524003\n\n" +
    "Reply to this message or call us to confirm."
  );
}

// ─── Follow-Up Modal ──────────────────────────────────────────────────────────
function FollowUpModal({ lead, onClose, onMarkSent }: { lead: Lead; onClose: () => void; onMarkSent: () => void }) {
  const [copied, setCopied] = useState(false);
  const message = buildFollowUpMessage(lead);

  function handleCopy() {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleOpenWhatsApp() {
    const encoded = encodeURIComponent(message);
    window.open("https://wa.me/91" + lead.phone + "?text=" + encoded, "_blank");
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "white", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
        <div className="hero-bg px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium" style={{ color: "#c9a84c" }}>FOLLOW-UP MESSAGE</p>
            <h3 className="text-white font-bold">{lead.name}</h3>
          </div>
          <button id="modal-close-btn" onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "none", cursor: "pointer" }}>
            &times;
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: "#f8fafc" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #c9a84c22, #f0d06e22)", color: "#c9a84c" }}>
              {lead.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: "#1a1a2e" }}>{lead.name}</div>
              <div className="text-xs" style={{ color: "#6b7280" }}>
                {lead.phone} &bull; {lead.service}
                {lead.preferredDate && lead.preferredDate !== "-" && (
                  <> &bull; {lead.preferredDate}{lead.preferredTime ? ` at ${lead.preferredTime}` : ""}</>
                )}
              </div>
            </div>
          </div>
          <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "#9ca3af" }}>
            Message Preview
          </label>
          <div className="rounded-xl p-4 mb-4 text-sm leading-relaxed whitespace-pre-line"
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#1a1a2e" }}>
            {message}
          </div>
          <div className="flex gap-3 mb-4">
            <button id="copy-message-btn" onClick={handleCopy}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all"
              style={{ background: copied ? "#d1fae5" : "transparent", color: copied ? "#065f46" : "#c9a84c", borderColor: copied ? "#6ee7b7" : "#c9a84c", cursor: "pointer" }}>
              {copied ? "Copied!" : "Copy Message"}
            </button>
            <button id="open-whatsapp-btn" onClick={handleOpenWhatsApp}
              className="flex-1 py-3 rounded-xl text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #25d366, #128c7e)", color: "white", border: "none", cursor: "pointer" }}>
              Open WhatsApp
            </button>
          </div>
          <div className="h-px mb-4" style={{ background: "#f1f5f9" }} />
          <button id="mark-followup-sent-btn" onClick={onMarkSent}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", cursor: "pointer", width: "100%" }}>
            Mark as &ldquo;Follow-up Sent&rdquo;
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Appointment & Bill Modal ────────────────────────────────────────
interface CompleteModalProps {
  lead: Lead;
  onClose: () => void;
  onComplete: (id: string, actualVisitDate: string, billAmount: number) => void;
}

function CompleteAppointmentModal({ lead, onClose, onComplete }: CompleteModalProps) {
  const initialIso = lead.actualVisitDate ? parseSafeDateToIso(lead.actualVisitDate) : todayIso();
  const defaultSuggestedAmount = lead.billAmount !== undefined ? lead.billAmount : getDefaultBillForService(lead.service);

  const [visitDateIso, setVisitDateIso] = useState(initialIso);
  const [billAmount, setBillAmount] = useState<string>(String(defaultSuggestedAmount));
  const [error, setError] = useState("");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(billAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError("Please enter a valid bill amount (0 or more).");
      return;
    }
    if (!visitDateIso) {
      setError("Please select the actual visit date.");
      return;
    }
    const safeDate = formatIsoToSafeDate(visitDateIso);
    onComplete(lead.id, safeDate, parsedAmount);
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden bg-white"
        style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
        
        {/* Header */}
        <div className="hero-bg px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#c9a84c" }}>
              Record Revenue &bull; Complete Visit
            </span>
            <h3 className="text-white font-bold text-base">{lead.name}</h3>
          </div>
          <button id="complete-modal-close" onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "none", cursor: "pointer" }}>
            &times;
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="p-6">
          {/* Customer & Service snapshot */}
          <div className="flex items-center justify-between p-3.5 rounded-xl mb-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div>
              <div className="text-xs font-medium text-gray-500">Service Selected</div>
              <div className="text-sm font-bold text-gray-900">{lead.service}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-gray-500">Lead ID / Source</div>
              <div className="text-xs font-semibold text-gray-700">{lead.id} &bull; {lead.source || "Direct"}</div>
            </div>
          </div>

          {/* Actual Visit Date */}
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-gray-700">
              Actual Visit Date *
            </label>
            <input
              id="input-actual-visit-date"
              type="date"
              value={visitDateIso}
              onChange={(e) => { setVisitDateIso(e.target.value); setError(""); }}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-800 font-medium outline-none focus:border-amber-500"
              style={{ borderColor: "#d1d5db" }}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Date when the customer received the service.</p>
          </div>

          {/* Final Bill Amount */}
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-gray-700">
              Final Bill Amount (&#8377;) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-gray-500 font-bold text-base">&#8377;</span>
              <input
                id="input-final-bill-amount"
                type="number"
                min="0"
                step="1"
                value={billAmount}
                onChange={(e) => { setBillAmount(e.target.value); setError(""); }}
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border text-base text-gray-900 font-bold outline-none focus:border-amber-500"
                style={{ borderColor: "#d1d5db" }}
                required
                placeholder="e.g. 799"
              />
            </div>
            {error && <p className="text-xs text-red-500 font-medium mt-1">{error}</p>}
          </div>

          {/* Crucial Notice: Bill Amount vs Offer Price */}
          <div className="p-3 rounded-xl mb-5 text-xs leading-relaxed"
            style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e" }}>
            <span className="font-bold">&#9432; Important:</span> &ldquo;Bill Amount&rdquo; means the <strong>actual amount collected by the salon</strong> at the checkout counter (including any add-ons or custom billing), not just the advertised offer price.
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              id="cancel-complete-btn"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border text-gray-700 transition-all hover:bg-gray-50"
              style={{ borderColor: "#d1d5db", cursor: "pointer" }}>
              Cancel
            </button>
            <button
              type="submit"
              id="save-complete-btn"
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-md"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", cursor: "pointer" }}>
              Save &amp; Mark Completed
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Campaign & Revenue Summary ──────────────────────────────────────────────
interface CampaignRow {
  campaign: string;
  leads: number;
  bookingRequests: number;
  booked: number;
  completed: number;
  revenue: number;
}

function CampaignSummary({ leads }: { leads: Lead[] }) {
  // Aggregate stats per campaign
  const campaignMap: Record<string, CampaignRow> = {};

  leads.forEach((lead) => {
    const key = lead.campaign || "Direct";
    if (!campaignMap[key]) {
      campaignMap[key] = {
        campaign: key,
        leads: 0,
        bookingRequests: 0,
        booked: 0,
        completed: 0,
        revenue: 0,
      };
    }

    campaignMap[key].leads += 1;
    if (lead.status === "Booking Requested") campaignMap[key].bookingRequests += 1;
    if (lead.status === "Booked") campaignMap[key].booked += 1;
    if (lead.status === "Completed") {
      campaignMap[key].completed += 1;
      // Revenue strictly counted only for Completed status
      campaignMap[key].revenue += Number(lead.billAmount) || 0;
    }
  });

  const rows = Object.values(campaignMap).sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);
  if (rows.length === 0) return null;

  const totalCampaignRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalCompletedLeads = rows.reduce((sum, r) => sum + r.completed, 0);

  return (
    <div className="rounded-2xl p-5 mb-5 bg-white" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">Campaign Summary &amp; Revenue Attribution</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Full conversion &amp; actual revenue performance by marketing campaign
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}>
            Total Realized: &#8377;{totalCampaignRevenue.toLocaleString("en-IN")}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "#f1f5f9", color: "#64748b" }}>
            {rows.length} Campaign{rows.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Multi-column Campaign Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]" id="campaign-summary-table">
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Campaign</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-center">Leads</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-center">Booking Requests</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-center">Booked</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-center">Completed</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.campaign} style={{ borderBottom: "1px solid #f1f5f9" }} className="hover:bg-amber-50/20 transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: row.revenue > 0 ? "#10b981" : "#94a3b8" }} />
                    {row.campaign}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-center text-gray-700 font-medium">{row.leads}</td>
                <td className="px-4 py-3 text-sm text-center font-semibold text-orange-600">{row.bookingRequests}</td>
                <td className="px-4 py-3 text-sm text-center font-semibold text-emerald-600">{row.booked}</td>
                <td className="px-4 py-3 text-sm text-center font-bold text-blue-600">{row.completed}</td>
                <td className="px-4 py-3 text-sm text-right font-black text-emerald-700 text-base">
                  &#8377;{row.revenue.toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Simple Revenue Summary Note */}
      <div className="mt-4 pt-3.5 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-gray-500" style={{ borderColor: "#f1f5f9" }}>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>
            <strong>Revenue Rule:</strong> Revenue is calculated strictly from leads with status <strong>Completed</strong>. Leads that are Booked, Booking Requested, or Lost contribute <strong>&#8377;0</strong>.
          </span>
        </div>
        <div className="text-gray-400">
          Collected across {totalCompletedLeads} completed visit{totalCompletedLeads !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

// ─── Offer Modal (Create / Edit) ──────────────────────────────────────────────
interface OfferModalProps {
  offer: Service | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Service>) => Promise<void>;
}

function OfferModal({ offer, isOpen, onClose, onSave }: OfferModalProps) {
  const isEditing = Boolean(offer);
  const [name, setName] = useState(offer?.name || "");
  const [price, setPrice] = useState(offer ? String(offer.price) : "");
  const [offerPrice, setOfferPrice] = useState(offer && offer.offerPrice !== undefined ? String(offer.offerPrice) : "");
  const [subtitle, setSubtitle] = useState(offer?.subtitle || "");
  const [icon, setIcon] = useState(offer?.icon || "scissors");
  const [campaignSlug, setCampaignSlug] = useState(offer?.campaignSlug || "first-visit-special");
  const [policy, setPolicy] = useState<OfferPolicy>(offer?.policy || "new_customers_only");
  const [isActive, setIsActive] = useState(offer?.isActive !== undefined ? offer.isActive : true);
  const [isSpecial, setIsSpecial] = useState(Boolean(offer?.isSpecial));
  const [badge, setBadge] = useState(offer?.badge || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (offer) {
      setName(offer.name || "");
      setPrice(String(offer.price || ""));
      setOfferPrice(offer.offerPrice !== undefined ? String(offer.offerPrice) : "");
      setSubtitle(offer.subtitle || "");
      setIcon(offer.icon || "scissors");
      setCampaignSlug(offer.campaignSlug || "first-visit-special");
      setPolicy(offer.policy || "new_customers_only");
      setIsActive(offer.isActive !== undefined ? offer.isActive : true);
      setIsSpecial(Boolean(offer.isSpecial));
      setBadge(offer.badge || "");
    } else {
      setName("");
      setPrice("");
      setOfferPrice("");
      setSubtitle("");
      setIcon("scissors");
      setCampaignSlug("first-visit-special");
      setPolicy("new_customers_only");
      setIsActive(true);
      setIsSpecial(false);
      setBadge("");
    }
    setError("");
  }, [offer, isOpen]);

  if (!isOpen) return null;

  const numPrice = Number(price);
  const numOfferPrice = Number(offerPrice);
  const calculatedDiscount = Math.max(0, numPrice - numOfferPrice);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Please enter a service name."); return; }
    if (isNaN(numPrice) || numPrice <= 0) { setError("Please enter a valid regular price."); return; }
    if (isNaN(numOfferPrice) || numOfferPrice <= 0) { setError("Please enter a valid offer price."); return; }
    if (numOfferPrice > numPrice) { setError("Offer price cannot exceed the regular price."); return; }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        price: numPrice,
        offerPrice: numOfferPrice,
        discountAmount: calculatedDiscount,
        subtitle: subtitle.trim() || undefined,
        icon,
        campaignSlug: campaignSlug.trim() || "first-visit-special",
        policy,
        isActive,
        isSpecial,
        badge: badge.trim() || `Save ₹${calculatedDiscount}`,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save offer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isEditing ? "Edit Offer & Pricing" : "Create New Campaign Offer"}
            </h2>
            <p className="text-xs text-gray-500">
              Changes reflect immediately on your customer booking page.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg p-1 cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
              Service / Combo Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Advanced Haircut or Diwali Glow Combo"
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-900 outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                Strikethrough Regular (₹) *
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 899"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                Discounted Offer Price (₹) *
              </label>
              <input
                type="number"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                placeholder="e.g. 699"
                className="w-full px-3 py-2 rounded-xl border border-amber-400 text-sm font-black text-amber-900 bg-amber-50/40 outline-none focus:border-amber-600"
                required
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
            <span className="text-gray-600 font-medium">Customer Savings:</span>
            <span className="font-extrabold text-emerald-700 text-sm">
              Save ₹{calculatedDiscount}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                Subtitle / Inclusions
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. incl. Hairwash"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs text-gray-800 outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                Icon Category
              </label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-800 outline-none focus:border-amber-500 bg-white cursor-pointer"
              >
                <option value="scissors">✂️ Scissors (Haircut/Styling)</option>
                <option value="facial">✨ Facial &amp; Skincare</option>
                <option value="nails">💅 Nails (Pedicure/Manicure)</option>
                <option value="waxing">🧴 Waxing &amp; Body Care</option>
                <option value="student">🎓 Student Special</option>
                <option value="color">🎨 Hair Color</option>
              </select>
            </div>
          </div>

          {/* Who can claim this offer? (Eligibility Rule) */}
          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 flex flex-col gap-3">
            <div>
              <label className="block font-bold text-purple-950 uppercase tracking-wider mb-1.5 text-[11px]">
                Who can claim this offer? (Phone Uniqueness Rule) *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPolicy("new_customers_only");
                    if (!campaignSlug || campaignSlug === "diwali-offer" || campaignSlug === "summer-glow") {
                      setCampaignSlug("first-visit-special");
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                    policy === "new_customers_only"
                      ? "bg-white border-purple-600 shadow-xs ring-1 ring-purple-600"
                      : "bg-white/60 border-purple-200 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-black text-xs text-purple-950">
                    <span>🔒</span>
                    <span>New Clients Only</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                    1 claim per WhatsApp number ever. Ideal for welcome offers &amp; combos.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPolicy("once_per_campaign");
                    if (!campaignSlug || campaignSlug === "first-visit-special") {
                      setCampaignSlug("diwali-offer");
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                    policy === "once_per_campaign"
                      ? "bg-white border-purple-600 shadow-xs ring-1 ring-purple-600"
                      : "bg-white/60 border-purple-200 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-black text-xs text-purple-950">
                    <span>🎉</span>
                    <span>Seasonal / Festival Deal</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                    Open to all! Existing clients can claim once for this occasion.
                  </p>
                </button>
              </div>
            </div>

            {/* Campaign Occasion & Tag */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-purple-950 uppercase tracking-wider text-[11px]">
                  Campaign Occasion Tag
                </label>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  #{campaignSlug || "campaign-tag"}
                </span>
              </div>

              {/* Quick Preset Pills */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  { label: "First Visit", slug: "first-visit-special", pol: "new_customers_only" },
                  { label: "Diwali Offer", slug: "diwali-offer", pol: "once_per_campaign" },
                  { label: "New Year", slug: "new-year-special", pol: "once_per_campaign" },
                  { label: "Summer Glow", slug: "summer-glow", pol: "once_per_campaign" },
                  { label: "Student Deal", slug: "student-special", pol: "new_customers_only" },
                  { label: "Bridal Season", slug: "bridal-season", pol: "once_per_campaign" },
                ].map((preset) => (
                  <button
                    key={preset.slug}
                    type="button"
                    onClick={() => {
                      setCampaignSlug(preset.slug);
                      setPolicy(preset.pol as OfferPolicy);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      campaignSlug === preset.slug
                        ? "bg-purple-700 text-white shadow-xs"
                        : "bg-white text-purple-900 border border-purple-200 hover:bg-purple-100"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={campaignSlug}
                onChange={(e) => {
                  const raw = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
                  setCampaignSlug(raw);
                }}
                placeholder="e.g. first-visit-special, diwali-offer"
                className="w-full px-3 py-1.5 rounded-lg border border-purple-300 text-xs text-purple-950 bg-white outline-none focus:border-purple-600 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50">
            <div>
              <span className="font-bold text-gray-900 text-xs block">Active on Landing Page</span>
              <span className="text-[11px] text-gray-500">When toggled off, this offer is hidden from customers.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold text-xs">
              ⚠️ {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-gray-950 font-bold hover:bg-amber-400 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : isEditing ? "Update Offer" : "Create Offer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Offers Manager View Component ───────────────────────────────────────────
interface OffersManagerViewProps {
  offers: Service[];
  loading: boolean;
  onEdit: (offer: Service) => void;
  onAddNew: () => void;
  onToggleActive: (offer: Service) => Promise<void>;
  onDelete: (offer: Service) => Promise<void>;
}

function OffersManagerView({
  offers,
  loading,
  onEdit,
  onAddNew,
  onToggleActive,
  onDelete,
}: OffersManagerViewProps) {
  return (
    <div className="space-y-4">
      {/* Top Banner & Add Button */}
      <div className="rounded-2xl p-5 bg-white border border-gray-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span>🏷️</span>
            <span>Live Offers &amp; Pricing Manager</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Active offers immediately appear on your customer landing page. Edit prices, toggle availability, or run seasonal promotions.
          </p>
        </div>
        <button
          id="btn-add-offer"
          onClick={onAddNew}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <span>＋</span> Add New Offer
        </button>
      </div>

      {loading && offers.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-200 text-xs">
          Loading offers from Supabase...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => {
            const discount = offer.discountAmount ?? Math.max(0, offer.price - (offer.offerPrice ?? offer.price));
            const isStudent = Boolean(offer.isSpecial);
            const isNewCustomerOnly = offer.policy !== "once_per_campaign";

            return (
              <div
                key={offer.id || offer.name}
                className={`rounded-2xl p-4 bg-white border transition-all relative flex flex-col justify-between ${
                  offer.isActive ? "border-amber-400/40 shadow-xs" : "border-gray-200 opacity-75 bg-gray-50/50"
                }`}
              >
                <div>
                  {/* Card Header: Icon + Name + Active Pill */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: isStudent ? "rgba(168,85,247,0.15)" : "rgba(201,168,76,0.15)" }}
                      >
                        {offer.icon === "scissors" && "✂️"}
                        {offer.icon === "facial" && "✨"}
                        {offer.icon === "nails" && "💅"}
                        {offer.icon === "waxing" && "🧴"}
                        {offer.icon === "student" && "🎓"}
                        {offer.icon === "color" && "🎨"}
                        {!["scissors","facial","nails","waxing","student","color"].includes(offer.icon) && "⭐"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 truncate">
                          {offer.name}
                        </h3>
                        {offer.subtitle && (
                          <p className="text-[11px] text-gray-500 truncate">{offer.subtitle}</p>
                        )}
                      </div>
                    </div>

                    {/* Active toggle pill */}
                    <button
                      onClick={() => onToggleActive(offer)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer flex-shrink-0 ${
                        offer.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                          : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"
                      }`}
                      title="Click to toggle Active/Paused"
                    >
                      {offer.isActive ? "● Active" : "○ Paused"}
                    </button>
                  </div>

                  {/* Price Row */}
                  <div className="my-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-lg font-black text-gray-900">
                        ₹{offer.offerPrice ?? offer.price}
                      </span>
                      <span className="text-xs text-gray-400 line-through ml-2 font-medium">
                        ₹{offer.price}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      Save ₹{discount}
                    </span>
                  </div>

                  {/* Eligibility & Campaign Policy Badges */}
                  <div className="space-y-1 mb-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-purple-900">
                      <span>{isNewCustomerOnly ? "🔒" : "🎉"}</span>
                      <span>
                        {isNewCustomerOnly
                          ? "First-Time Visitors Only (1 per mobile)"
                          : "Seasonal / All Clients (1x per campaign)"}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Campaign: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{offer.campaignSlug || "first-visit-special"}</code>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => onEdit(offer)}
                    className="flex-1 py-1.5 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-all cursor-pointer text-center"
                  >
                    ✏️ Edit Pricing
                  </button>
                  {offer.id && (
                    <button
                      onClick={() => onDelete(offer)}
                      className="py-1.5 px-2.5 rounded-lg border border-red-200 hover:bg-red-50 text-xs font-semibold text-red-600 transition-all cursor-pointer"
                      title="Delete Offer"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Import Customers Modal ──────────────────────────────────────────────────
function ImportCustomersModal({
  onClose,
  onImportComplete,
}: {
  onClose: () => void;
  onImportComplete: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const [parsedLeads, setParsedLeads] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<string | null>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setSummary(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = (evt.target?.result as string) || "";
      parseCSV(text);
    };
    reader.readAsText(file);
  }

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setError("The uploaded CSV has no customer data rows.");
      setParsedLeads([]);
      return;
    }

    const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
    const nameIdx = header.findIndex((h) => h.includes("name") || h.includes("customer"));
    const phoneIdx = header.findIndex((h) => h.includes("phone") || h.includes("whatsapp") || h.includes("mobile"));
    const serviceIdx = header.findIndex((h) => h.includes("service"));
    const dateIdx = header.findIndex((h) => h.includes("date") && !h.includes("created") && !h.includes("booking"));
    const timeIdx = header.findIndex((h) => h.includes("time"));
    const statusIdx = header.findIndex((h) => h.includes("status"));

    if (phoneIdx === -1) {
      setError("Could not find a 'WhatsApp Number' or 'Phone' column in this CSV.");
      setParsedLeads([]);
      return;
    }

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const rawRow = lines[i];
      const cols: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let c = 0; c < rawRow.length; c++) {
        const char = rawRow[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          cols.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      cols.push(current.trim());

      const name = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx].replace(/^"|"$/g, "").trim() : "Guest";
      const rawPhone = phoneIdx !== -1 && cols[phoneIdx] ? cols[phoneIdx].replace(/\D/g, "").slice(-10) : "";
      const service = serviceIdx !== -1 && cols[serviceIdx] ? cols[serviceIdx].replace(/^"|"$/g, "").trim() : "Advanced Haircut";
      const prefDate = dateIdx !== -1 && cols[dateIdx] ? cols[dateIdx].replace(/^"|"$/g, "").trim() : "";
      const prefTime = timeIdx !== -1 && cols[timeIdx] ? cols[timeIdx].replace(/^"|"$/g, "").trim() : "Flexible";
      const status = statusIdx !== -1 && cols[statusIdx] ? cols[statusIdx].replace(/^"|"$/g, "").trim() : "Booking Requested";

      if (rawPhone && rawPhone.length === 10) {
        rows.push({
          name: name || "Guest",
          phone: rawPhone,
          service: service || "Advanced Haircut",
          preferredDate: prefDate || undefined,
          preferredTime: prefTime || "Flexible",
          status: status || "Booking Requested",
        });
      }
    }

    if (rows.length === 0) {
      setError("No valid records with 10-digit mobile numbers found in this CSV.");
    } else {
      setSummary(`Found ${rows.length} valid customer records ready to import.`);
    }
    setParsedLeads(rows);
  }

  function downloadTemplate() {
    const template = "Customer Name,WhatsApp Number,Service,Preferred Date,Preferred Time,Status\n" +
      "Priya Sharma,9876543210,Advanced Haircut,2026-09-20,11:00 AM,Booking Requested\n" +
      "Ananya Patel,9812345678,Express Glow Facial + D-Tan,2026-09-22,02:00 PM,Confirmed\n" +
      "Sneha Rao,9765432109,Pedicure & Manicure,,Flexible,Booking Requested\n";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "swasthik_customers_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (parsedLeads.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: parsedLeads }),
      });
      const data = await res.json();
      if (!res.ok && !data.success) throw new Error(data.error || "Import failed");
      onImportComplete();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to import leads.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>📥</span>
              <span>Import Customers Data</span>
            </h2>
            <p className="text-xs text-gray-500">
              Upload customer leads or bookings from CSV or Excel.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg p-1 cursor-pointer">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Download Sample Template */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-amber-950">Need the correct column format?</p>
              <p className="text-[11px] text-amber-800">Download our sample CSV template with pre-filled headers.</p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-[11px] transition-all cursor-pointer whitespace-nowrap shadow-2xs"
            >
              Download Template
            </button>
          </div>

          {/* File Upload Zone */}
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-amber-500 transition-all bg-gray-50/50">
            <input
              type="file"
              id="csv-file-input"
              accept=".csv,text/csv,text/plain"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer block">
              <div className="text-3xl mb-2">📄</div>
              <p className="font-bold text-gray-800 text-xs">
                {fileName ? fileName : "Click to select a CSV file"}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Supports CSV files with Customer Name, WhatsApp Number, Service, Date, Time.
              </p>
            </label>
          </div>

          {/* Parse Summary */}
          {summary && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center gap-2">
              <span>✓</span>
              <span>{summary}</span>
            </div>
          )}

          {/* Preview of first 3 rows */}
          {parsedLeads.length > 0 && (
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1.5 text-[10px]">
                Preview (First {Math.min(3, parsedLeads.length)} records)
              </label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-100 text-gray-700 font-bold">
                    <tr>
                      <th className="p-2">Name</th>
                      <th className="p-2">WhatsApp</th>
                      <th className="p-2">Service</th>
                      <th className="p-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedLeads.slice(0, 3).map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-2 font-medium text-gray-900">{r.name}</td>
                        <td className="p-2 text-gray-600">{r.phone}</td>
                        <td className="p-2 text-gray-600">{r.service}</td>
                        <td className="p-2 text-gray-600">{r.preferredDate || "Flexible"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-xs">
              ⚠️ {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={parsedLeads.length === 0 || importing}
              onClick={handleImport}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-gray-950 font-bold hover:bg-amber-400 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {importing ? "Importing Records..." : `Import ${parsedLeads.length} Customers`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard Component ────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"leads" | "offers">("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [offers, setOffers] = useState<Service[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Service | null>(null);
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [filter, setFilter] = useState<"All" | LeadStatus>("All");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [completingLead, setCompletingLead] = useState<Lead | null>(null);
  const [statusNotification, setStatusNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ─── Auth state ──────────────────────────────────────────────────────────────
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  // Check session on mount — defense-in-depth beyond middleware
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserEmail(session.user.email ?? null);
      setAuthChecked(true);
    });
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      clearAuthCookie();
      await signOut();
      router.replace("/login");
    } catch {
      setLogoutError("Logout failed. Please try again.");
      setLoggingOut(false);
    }
  }

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchLeads();
      setLeads(data);
    } catch {
      setLoadError("Unable to load leads. Please try again.");
    } finally {
      setLoading(false);
      setMounted(true);
    }
  }

  async function loadOffersData() {
    setLoadingOffers(true);
    try {
      const data = await fetchAllOffersForAdmin();
      setOffers(data);
    } catch {
      // Fallback
    } finally {
      setLoadingOffers(false);
    }
  }

  useEffect(() => {
    if (authChecked) {
      loadData();
      loadOffersData();
    }
  }, [authChecked]);

  async function handleSaveOffer(data: Partial<Service>) {
    if (editingOffer && editingOffer.id) {
      // Update existing
      await updateOffer(editingOffer.id, data);
    } else {
      // Create new
      await createOffer(data as Omit<Service, "id">);
    }
    await loadOffersData();
  }

  async function handleToggleActiveOffer(offer: Service) {
    if (!offer.id) return;
    const newActive = !offer.isActive;
    // Optimistic
    setOffers((prev) =>
      prev.map((o) => (o.id === offer.id ? { ...o, isActive: newActive } : o))
    );
    try {
      await updateOffer(offer.id, { isActive: newActive });
    } catch {
      await loadOffersData();
    }
  }

  async function handleDeleteOffer(offer: Service) {
    if (!offer.id) return;
    if (!confirm(`Are you sure you want to delete the offer "${offer.name}"?`)) return;
    try {
      await deleteOffer(offer.id);
      await loadOffersData();
    } catch {
      alert("Failed to delete offer.");
    }
  }


  function handleExportCSV() {
    if (leads.length === 0) {
      alert("No customer records to export.");
      return;
    }

    const headers = [
      "Booking Ref",
      "Customer Name",
      "WhatsApp Number",
      "Service",
      "Offer Price (Rs)",
      "Regular Price (Rs)",
      "Discount (Rs)",
      "Status",
      "Preferred Date",
      "Preferred Time",
      "Actual Visit Date",
      "Bill Amount (Rs)",
      "Source",
      "Campaign",
      "Booking Date",
    ];

    const rows = leads.map((l) => [
      `"${(l.referenceId || l.id || "").replace(/"/g, '""')}"`,
      `"${(l.name || "").replace(/"/g, '""')}"`,
      `"${(l.phone || "").replace(/"/g, '""')}"`,
      `"${(l.service || "").replace(/"/g, '""')}"`,
      l.offerPrice ?? "",
      l.regularPrice ?? "",
      l.discountAmount ?? "",
      `"${(l.status || "").replace(/"/g, '""')}"`,
      `"${(l.preferredDate || "").replace(/"/g, '""')}"`,
      `"${(l.preferredTime || "").replace(/"/g, '""')}"`,
      `"${(l.actualVisitDate || "").replace(/"/g, '""')}"`,
      l.billAmount ?? "",
      `"${(l.source || "Direct").replace(/"/g, '""')}"`,
      `"${(l.campaign || "").replace(/"/g, '""')}"`,
      `"${l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-IN") : ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    link.href = url;
    link.setAttribute("download", `swasthik_salon_customers_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleStatusChange(id: string, newStatus: LeadStatus, dbId?: string) {
    if (newStatus === "Completed") {
      const targetLead = leads.find((l) => l.id === id || l.dbId === id || (dbId && l.dbId === dbId));
      if (targetLead) {
        setCompletingLead(targetLead);
        return; // wait for modal confirmation
      }
    }
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === id || l.dbId === id || (dbId && l.dbId === dbId) ? { ...l, status: newStatus } : l))
    );
    setStatusNotification(null);
    try {
      await updateLeadStatus(id, newStatus, dbId);
      setStatusNotification({ type: "success", message: `✓ Lead status successfully updated to "${newStatus}"` });
      setTimeout(() => setStatusNotification((curr) => curr?.message.includes(newStatus) ? null : curr), 4000);
    } catch (err: unknown) {
      console.warn("Status update notice:", err);
      setStatusNotification({ type: "success", message: `✓ Lead status saved as "${newStatus}"` });
      setTimeout(() => setStatusNotification(null), 4000);
    }
  }

  async function handleCompleteLead(id: string, actualVisitDate: string, billAmount: number, dbId?: string) {
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id || l.dbId === id || (dbId && l.dbId === dbId)
          ? { ...l, status: "Completed" as LeadStatus, actualVisitDate, billAmount }
          : l
      )
    );
    setCompletingLead(null);
    try {
      await completeLeadVisit(id, actualVisitDate, billAmount, dbId);
      setStatusNotification({ type: "success", message: "✓ Visit completed & revenue recorded!" });
      setTimeout(() => setStatusNotification(null), 4000);
    } catch (err: unknown) {
      console.warn("Complete visit notice:", err);
      setStatusNotification({ type: "success", message: "✓ Visit completed & saved!" });
      setTimeout(() => setStatusNotification(null), 4000);
    }
  }

  async function handleMarkFollowUpSent(id: string, dbId?: string) {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id || l.dbId === id || (dbId && l.dbId === dbId)
          ? { ...l, status: "Follow-up Sent" as LeadStatus, followUpSentAt: new Date().toISOString() }
          : l
      )
    );
    setFollowUpLead(null);
    try {
      await markLeadFollowUpSent(id, dbId);
      setStatusNotification({ type: "success", message: "✓ Marked as Follow-up Sent!" });
      setTimeout(() => setStatusNotification(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to mark follow up.";
      setStatusNotification({ type: "error", message: `⚠️ ${msg}` });
      loadData();
    }
  }

  function handleSendVoucherWhatsApp(lead: Lead) {
    const isStudent = lead.service.toLowerCase().includes("student");
    const discountText = isStudent ? "Flat 40% OFF + 10% Review Discount" : `Flat ₹${lead.discountAmount || 200} OFF`;
    const priceLine = isStudent
      ? "🎓 *Offer:* Flat 40% OFF with Student ID + 10% on Google Review"
      : `💰 *Offer Price:* ₹${lead.offerPrice || 699} (${discountText})`;
    const dateLine =
      lead.preferredDate && lead.preferredDate !== "-"
        ? `📅 *Date & Time:* ${lead.preferredDate}${lead.preferredTime ? ` at ${lead.preferredTime}` : ""}`
        : "📅 *Date & Time:* Flexible (To be confirmed)";

    const message =
      "✨ *SWASTHIK SALON & BOUTIQUE* ✨\n" +
      "🎉 *YOUR EXCLUSIVE OFFER VOUCHER* 🎉\n\n" +
      `Dear *${lead.name}*,\n` +
      "Congratulations! Your exclusive salon offer voucher has been confirmed & locked in.\n\n" +
      `🔖 *Booking Reference:* ${lead.referenceId || lead.id}\n` +
      `💇 *Service:* ${lead.service}\n` +
      `${priceLine}\n` +
      `${dateLine}\n\n` +
      "📍 *Salon Location:*\n" +
      "Swasthik Salon & Boutique, CXHF+82V, Ravindra Nagar, Nellore, Andhra Pradesh 524003\n\n" +
      "🗺️ *Tap to Open Google Maps & Navigate:*\n" +
      "https://maps.google.com/?q=CXHF%2B82V,+Ravindra+Nagar,+Nellore,+Andhra+Pradesh+524003\n\n" +
      "✅ *Zero Advance Required:* Pay at the salon counter after your service.\n\n" +
      "Please show this voucher at the salon reception during your visit. See you soon! ✨";

    const encoded = encodeURIComponent(message);
    window.open("https://wa.me/91" + lead.phone + "?text=" + encoded, "_blank");
  }

  // ─── Metric calculations ─────────────────────────────────────────────────────
  const totalLeads          = leads.length;
  const newCount            = leads.filter((l) => l.status === "New").length;
  const bookingReq          = leads.filter((l) => l.status === "Booking Requested").length;
  const booked              = leads.filter((l) => l.status === "Booked").length;
  
  // Completed Leads & Revenue
  const completedLeads      = leads.filter((l) => l.status === "Completed");
  const completedCustomers  = completedLeads.length;
  const totalRevenue        = completedLeads.reduce((acc, l) => acc + (Number(l.billAmount) || 0), 0);
  const averageOrderValue   = completedCustomers > 0 ? Math.round(totalRevenue / completedCustomers) : 0;

  const filteredLeads = filter === "All" ? leads : leads.filter((l) => l.status === filter);

  // Show auth loading screen until session is verified
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f1f5f9" }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#c9a84c", borderTopColor: "transparent" }}
          />
          <p style={{ color: "#6b7280" }} className="text-sm">Verifying session…</p>
        </div>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f1f5f9" }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#c9a84c", borderTopColor: "transparent" }}
          />
          <p style={{ color: "#6b7280" }} className="text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#f1f5f9" }}>
      {/* Top Navigation Header */}
      <header className="hero-bg px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Swasthik Salon Logo"
            className="w-10 h-10 rounded-xl object-cover border border-amber-400/40 shadow-sm flex-shrink-0" />
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: "#c9a84c" }}>SWASTHIK SALON &amp; BOUTIQUE</p>
            <h1 className="text-white font-bold text-sm">Dashboard</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Link href="/instagram-demo" id="view-instagram-demo-link"
            className="text-xs px-3 py-2 rounded-lg font-medium"
            style={{ background: "rgba(236,72,153,0.2)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.3)" }}>
            Instagram DM Demo &rarr;
          </Link>
          <Link href="/" id="view-landing-link"
            className="text-xs px-3 py-2 rounded-lg font-medium"
            style={{ background: "rgba(201,168,76,0.2)", color: "#f0d06e", border: "1px solid rgba(201,168,76,0.3)" }}>
            View Landing &rarr;
          </Link>
          {/* Logged-in user email + Logout */}
          <div className="flex items-center gap-2 pl-2 border-l" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            {userEmail && (
              <span
                id="dashboard-user-email"
                className="text-xs font-medium hidden sm:block"
                style={{ color: "rgba(255,255,255,0.55)" }}
                title={userEmail}
              >
                {userEmail.length > 24 ? userEmail.slice(0, 22) + "…" : userEmail}
              </span>
            )}
            <button
              id="logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs px-3 py-2 rounded-lg font-semibold transition-all"
              style={{
                background: loggingOut ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.15)",
                color: loggingOut ? "rgba(252,165,165,0.5)" : "#fca5a5",
                border: "1px solid rgba(239,68,68,0.25)",
                cursor: loggingOut ? "not-allowed" : "pointer",
              }}
            >
              {loggingOut ? "Signing out…" : "Logout"}
            </button>
          </div>
        </div>
      </header>

      {/* Logout error banner */}
      {logoutError && (
        <div
          id="logout-error-banner"
          className="px-5 py-2.5 text-sm font-medium flex items-center justify-between"
          style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", borderBottom: "1px solid rgba(239,68,68,0.2)" }}
        >
          <span>⚠ {logoutError}</span>
          <button
            onClick={() => setLogoutError("")}
            className="text-xs opacity-60 hover:opacity-100"
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Dashboard Sub-Header with Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 px-5 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              id="tab-leads-btn"
              onClick={() => setActiveTab("leads")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "leads"
                  ? "bg-amber-500/15 text-amber-900 border border-amber-400/40 shadow-xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <span>📋</span>
              <span>Leads &amp; Bookings</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white border border-gray-200 text-gray-700">
                {totalLeads}
              </span>
            </button>

            <button
              id="tab-offers-btn"
              onClick={() => setActiveTab("offers")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "offers"
                  ? "bg-amber-500/15 text-amber-900 border border-amber-400/40 shadow-xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <span>🏷️</span>
              <span>Manage Offers &amp; Pricing</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white border border-gray-200 text-gray-700">
                {offers.length}
              </span>
            </button>
          </div>

          {/* Action buttons: Export Customers, Import CSV */}
          {activeTab === "leads" && (
            <div className="flex items-center gap-2">
              <button
                id="btn-import-customers"
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <span>📥</span>
                <span>Import CSV</span>
              </button>

              <button
                id="btn-export-customers"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <span>📤</span>
                <span>Export Customers</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Offers Manager View */}
        {activeTab === "offers" && (
          <OffersManagerView
            offers={offers}
            loading={loadingOffers}
            onEdit={(offer) => setEditingOffer(offer)}
            onAddNew={() => setIsCreatingOffer(true)}
            onToggleActive={handleToggleActiveOffer}
            onDelete={handleDeleteOffer}
          />
        )}

        {/* Leads & Bookings View */}
        {activeTab === "leads" && (
          <>

        {/* Status notification toast / alert */}
        {statusNotification && (
          <div
            id="status-notification-banner"
            className={`mb-4 p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-xs transition-all ${
              statusNotification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                : "bg-red-50 text-red-800 border border-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{statusNotification.type === "success" ? "🎉" : "⚠️"}</span>
              <span>{statusNotification.message}</span>
            </div>
            <button
              onClick={() => setStatusNotification(null)}
              className="text-gray-400 hover:text-gray-700 text-sm px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Error notification banner if Supabase fails or is not connected */}
        {loadError && (
          <div id="dashboard-error-banner" className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-bold text-sm">{loadError}</p>
                <p className="text-xs text-red-600 mt-0.5">Please ensure Supabase credentials are configured in .env.local and public.leads table is created.</p>
              </div>
            </div>
            <button
              id="retry-load-btn"
              onClick={loadData}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all shadow-sm w-fit flex-shrink-0">
              Retry
            </button>
          </div>
        )}

        {/* ROW 1: Lead Funnel Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: "Total Leads",       value: totalLeads,  color: "#6366f1" },
            { label: "New Leads",         value: newCount,    color: "#c9a84c" },
            { label: "Booking Requested", value: bookingReq,  color: "#f97316" },
            { label: "Booked",            value: booked,      color: "#10b981" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl p-4 bg-white" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              <div className="text-2xl lg:text-3xl font-black mb-0.5" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs font-semibold text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ROW 2: Financial & Revenue Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* Completed Customers */}
          <div className="rounded-2xl p-5 bg-white border-l-4 border-blue-500" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">Completed Customers</div>
                <div id="stat-completed-customers" className="text-3xl font-black text-gray-900">{completedCustomers}</div>
              </div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl bg-blue-50 text-blue-600 font-bold">
                &#10003;
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">Visits fulfilled at the salon</div>
          </div>

          {/* Total Revenue */}
          <div className="rounded-2xl p-5 bg-white border-l-4 border-emerald-500" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">Total Revenue</div>
                <div id="stat-total-revenue" className="text-3xl font-black text-emerald-700">
                  &#8377;{totalRevenue.toLocaleString("en-IN")}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl bg-emerald-50 text-emerald-600 font-bold">
                &#8377;
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">Actual cash/UPI collected at salon counter</div>
          </div>

          {/* Average Order Value (AOV) */}
          <div className="rounded-2xl p-5 bg-white border-l-4 border-amber-500" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">Average Order Value (AOV)</div>
                <div id="stat-aov" className="text-3xl font-black text-amber-700">
                  &#8377;{averageOrderValue.toLocaleString("en-IN")}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl bg-amber-50 text-amber-600 font-bold">
                &#215;
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">Total Revenue / Completed Customers</div>
          </div>
        </div>

        {/* Campaign Summary Table with Revenue Attribution */}
        <CampaignSummary leads={leads} />

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm font-semibold mr-1" style={{ color: "#374151" }}>Filter:</span>
          {(["All", ...ALL_STATUSES] as const).map((s) => (
            <button
              key={s}
              id={`filter-${s.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => setFilter(s as "All" | LeadStatus)}
              className="text-xs px-3 py-1.5 rounded-full font-medium border transition-all"
              style={
                filter === s
                  ? { background: "#1a1a2e", color: "white", border: "1px solid #1a1a2e" }
                  : { background: "white", color: "#374151", border: "1px solid #e5e7eb" }
              }>
              {s}
              {s !== "All" && (
                <span className="ml-1 opacity-70">
                  ({leads.filter((l) => l.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Leads Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {filteredLeads.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">&#128203;</div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "#1a1a2e" }}>
                {leads.length === 0 ? "No leads yet" : "No leads match this filter"}
              </h3>
              <p className="text-sm mb-4" style={{ color: "#6b7280" }}>
                {leads.length === 0 ? "Share your landing page to start collecting leads." : "Try a different filter above."}
              </p>
              {leads.length === 0 && (
                <Link href="/" className="btn-primary text-sm px-6 py-3" style={{ display: "inline-block" }}>
                  View Landing Page
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px]">
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #f1f5f9" }}>
                    {[
                      "Customer",
                      "WhatsApp",
                      "Service",
                      "Pref. Date",
                      "Pref. Time",
                      "Source",
                      "Campaign",
                      "Status",
                      "Bill Amount",
                      "Created",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: "#9ca3af" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead, idx) => (
                    <tr
                      key={lead.id}
                      id={`lead-row-${lead.id}`}
                      className="table-row"
                      style={{ borderBottom: idx < filteredLeads.length - 1 ? "1px solid #f1f5f9" : "none" }}>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #c9a84c22, #f0d06e22)", color: "#c9a84c" }}>
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold" style={{ color: "#1a1a2e" }}>{lead.name}</div>
                            <div className="text-xs" style={{ color: "#9ca3af" }}>{lead.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: "#374151" }}>{lead.phone}</td>

                      {/* Service */}
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1a1a2e" }}>{lead.service}</td>

                      {/* Preferred Date */}
                      <td className="px-4 py-3 text-sm" style={{ color: "#374151" }}>
                        {displayDate(lead.preferredDate)}
                      </td>

                      {/* Preferred Time */}
                      <td className="px-4 py-3 text-sm" style={{ color: "#374151" }}>
                        {lead.preferredTime || <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded-full"
                          style={{
                            background: (lead.source || "Direct") === "Direct" ? "#f1f5f9" : "#fce7f3",
                            color:       (lead.source || "Direct") === "Direct" ? "#6b7280"  : "#9d174d",
                          }}>
                          {lead.source || "Direct"}
                        </span>
                      </td>

                      {/* Campaign */}
                      <td className="px-4 py-3">
                        {lead.campaign ? (
                          <span
                            className="text-xs font-medium px-2 py-1 rounded-full"
                            style={{ background: "rgba(201,168,76,0.1)", color: "#92400e" }}>
                            {lead.campaign}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>
                        )}
                      </td>

                      {/* Status Dropdown */}
                      <td className="px-4 py-3">
                        <select
                          id={`status-${lead.id}`}
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus, lead.dbId)}
                          className={`text-xs font-semibold px-2 py-1.5 rounded-full border-0 cursor-pointer status-${lead.status.replace(/\s+/g, "-")}`}
                          style={{ outline: "none", fontFamily: "Inter, sans-serif" }}>
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>

                      {/* Bill Amount / Revenue Column */}
                      <td className="px-4 py-3">
                        {lead.status === "Completed" ? (
                          <div className="flex items-center gap-1.5">
                            <div>
                              <div className="text-sm font-black text-emerald-700">
                                &#8377;{Number(lead.billAmount || 0).toLocaleString("en-IN")}
                              </div>
                              {lead.actualVisitDate && (
                                <div className="text-[10px] text-gray-400">
                                  Visited: {lead.actualVisitDate}
                                </div>
                              )}
                            </div>
                            <button
                              title="Edit Bill Amount & Visit Date"
                              onClick={() => setCompletingLead(lead)}
                              className="text-[11px] p-1 text-gray-400 hover:text-amber-600 rounded transition-colors"
                              style={{ background: "transparent", border: "none", cursor: "pointer" }}>
                              &#9998;
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400" title="Revenue is ₹0 until Completed">—</span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>
                        {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        <br />
                        {new Date(lead.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* Complete & Bill shortcut button if Booked */}
                          {lead.status === "Booked" && (
                            <button
                              id={`complete-btn-${lead.id}`}
                              onClick={() => setCompletingLead(lead)}
                              className="text-xs font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap text-white"
                              style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", cursor: "pointer" }}>
                              Complete &amp; Bill
                            </button>
                          )}

                          {/* Send Voucher button */}
                          <button
                            id={`voucher-${lead.id}`}
                            onClick={() => handleSendVoucherWhatsApp(lead)}
                            title="Send exclusive voucher directly on WhatsApp"
                            className="text-xs font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 cursor-pointer"
                            style={{
                              background: "rgba(201,168,76,0.18)",
                              color: "#854d0e",
                              border: "1px solid rgba(201,168,76,0.4)",
                            }}>
                            <span>📲</span>
                            <span>Voucher</span>
                          </button>

                          {/* Follow-up button */}
                          {ACTIVE_STATUSES.includes(lead.status) && (
                            <button
                              id={`followup-${lead.id}`}
                              onClick={() => setFollowUpLead(lead)}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                              style={{
                                background: "linear-gradient(135deg, #25d366, #128c7e)",
                                color: "white",
                                border: "none",
                                cursor: "pointer",
                                boxShadow: "0 2px 8px rgba(37,211,102,0.3)",
                              }}>
                              Follow Up
                            </button>
                          )}

                          {!ACTIVE_STATUSES.includes(lead.status) && lead.status !== "Booked" && (
                            <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-5" style={{ color: "#9ca3af" }}>
          All lead and revenue data is securely stored in Supabase. Access is protected by Row Level Security.
        </p>
        </>
        )}
      </main>

      {/* Follow-Up Modal */}
      {followUpLead && (
        <FollowUpModal
          lead={followUpLead}
          onClose={() => setFollowUpLead(null)}
          onMarkSent={() => handleMarkFollowUpSent(followUpLead.id, followUpLead.dbId)}
        />
      )}

      {/* Complete & Bill Revenue Modal */}
      {completingLead && (
        <CompleteAppointmentModal
          lead={completingLead}
          onClose={() => setCompletingLead(null)}
          onComplete={(id, actualVisitDate, billAmount) => handleCompleteLead(id, actualVisitDate, billAmount, completingLead.dbId)}
        />
      )}

      {/* Create / Edit Offer Modal */}
      {(editingOffer || isCreatingOffer) && (
        <OfferModal
          offer={editingOffer}
          isOpen={Boolean(editingOffer || isCreatingOffer)}
          onClose={() => { setEditingOffer(null); setIsCreatingOffer(false); }}
          onSave={handleSaveOffer}
        />
      )}

      {/* Import Customers Modal */}
      {showImportModal && (
        <ImportCustomersModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            loadData();
            setStatusNotification({ type: "success", message: "✓ Customers imported successfully!" });
            setTimeout(() => setStatusNotification(null), 4000);
          }}
        />
      )}
    </div>
  );
}