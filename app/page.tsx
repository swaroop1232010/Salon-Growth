"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SERVICES, DISCOUNT, OFFER_TEXT } from "./lib/services";
import { generateLeadId, saveLead } from "./lib/storage";
import { Lead, LeadStatus } from "./types";

// ─── Date helpers ─────────────────────────────────────────────────────────────
// Store dates as "15 Sep 2026" — avoids all timezone / ISO parsing ambiguity
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDateSafe(isoValue: string): string {
  // isoValue is "YYYY-MM-DD" from the date input
  if (!isoValue) return "";
  const [y, m, d] = isoValue.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ─── Time options ─────────────────────────────────────────────────────────────
const TIME_SLOTS = [
  "10:00 AM","11:00 AM","12:00 PM","1:00 PM","2:00 PM",
  "3:00 PM","4:00 PM","5:00 PM","6:00 PM","7:00 PM","8:00 PM",
];

// ─── UTM helpers ──────────────────────────────────────────────────────────────
function formatUtm(val: string): string {
  if (val.toLowerCase() === "dm") return "DM";
  if (val.toLowerCase() === "instagram_dm") return "Instagram DM";
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
interface UtmData { source: string; medium: string; campaign: string; }

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function ServiceIcon({ icon, size = 28, color = "#c9a84c" }: { icon: string; size?: number; color?: string }) {
  const s = size;
  switch (icon) {
    case "scissors":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>;
    case "spa":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10"/><path d="M12 2c1.5 2.5 2 5 2 10"/><path d="M12 2c-1.5 2.5-2 5-2 10"/><path d="M2 12h20"/></svg>;
    case "face":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
    case "color":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 13.5A10 10 0 1 0 12 2"/><path d="M12 6v6l4 2"/></svg>;
    case "beard":
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9a9 9 0 1 0 18 0"/><path d="M3 9c0 5 2 8 9 10 7-2 9-5 9-10"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
    default:
      return <span style={{ fontSize: s * 0.7, color }}>{icon}</span>;
  }
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

type Step = "landing" | "form" | "success";

export default function Home() {
  const [step, setStep] = useState<Step>("landing");
  const [selectedService, setSelectedService] = useState<string>("");
  const [submittedLead, setSubmittedLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", preferredDate: "", preferredTime: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingMsg, setBookingMsg] = useState(false);
  const [utmData, setUtmData] = useState<UtmData>({ source: "Direct", medium: "", campaign: "" });
  const [highlightServices, setHighlightServices] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const rs = p.get("utm_source") || "";
    const rm = p.get("utm_medium") || "";
    const rc = p.get("utm_campaign") || "";
    setUtmData({
      source:   rs ? formatUtm(rs) : "Direct",
      medium:   rm ? formatUtm(rm) : "",
      campaign: rc ? formatUtm(rc) : "",
    });

    const sParam = p.get("service");
    let matchedServiceName = "";
    if (sParam) {
      const match = SERVICES.find(s => s.name.toLowerCase() === sParam.toLowerCase());
      if (match) {
        matchedServiceName = match.name;
        setSelectedService(match.name);
      }
    }
    if (p.get("claim") === "true") {
      if (matchedServiceName) {
        setSelectedService(matchedServiceName);
        setStep("form");
      }
    }
  }, []);

  function validate() {
    const e: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.trim().length < 2)
      e.name = "Please enter your full name (min 2 characters).";
    if (!/^[6-9]\d{9}$/.test(formData.phone))
      e.phone = "Enter a valid 10-digit Indian mobile number.";
    if (!formData.preferredDate)
      e.preferredDate = "Please select your preferred visit date.";
    if (!formData.preferredTime)
      e.preferredTime = "Please select a preferred time slot.";
    return e;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSubmitting(true);
    setTimeout(() => {
      const lead: Lead = {
        id: generateLeadId(),
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        service: selectedService,
        // Store date as "15 Sep 2026" — safe, unambiguous
        preferredDate: formatDateSafe(formData.preferredDate),
        preferredTime: formData.preferredTime,
        source:   utmData.source,
        medium:   utmData.medium,
        campaign: utmData.campaign,
        status: "New" as LeadStatus,
        createdAt: new Date().toISOString(),
      };
      saveLead(lead);
      setSubmittedLead(lead);
      setIsSubmitting(false);
      setStep("success");
    }, 800);
  }

  function goHome() {
    setStep("landing"); setSelectedService("");
    setFormData({ name: "", phone: "", preferredDate: "", preferredTime: "" });
    setErrors({}); setBookingMsg(false); setSubmittedLead(null);
  }

  function claimOffer() {
    if (!selectedService) {
      document.getElementById("services-grid")?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightServices(true);
      setTimeout(() => setHighlightServices(false), 1800);
      return;
    }
    setStep("form");
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // LANDING PAGE
  // ══════════════════════════════════════════════════════════════════════════════
  if (step === "landing") {
    return (
      <main style={{ background: "#0f0f1a", minHeight: "100vh" }}>

        {/* Top bar */}
        <div style={{ background: "rgba(201,168,76,0.08)", borderBottom: "1px solid rgba(201,168,76,0.15)" }}
          className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #c9a84c, #f0d06e)" }}>
              <ServiceIcon icon="scissors" size={13} color="#1a1a2e" />
            </div>
            <span className="text-xs font-bold tracking-widest" style={{ color: "#c9a84c" }}>
              SWASTHIK SALON &amp; BOUTIQUE
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: "rgba(201,168,76,0.15)", color: "#f0d06e", border: "1px solid rgba(201,168,76,0.25)" }}>
              &#9733; 4.9 Rated Salon
            </div>
            <a href="tel:+918501020553" id="customer-call-btn"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.15)" }}>
              &#128222; Call Salon
            </a>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row" style={{ minHeight: "calc(100vh - 49px)" }}>

          {/* LEFT: Offer hero */}
          <div className="lg:flex-1 relative flex flex-col justify-center px-6 py-12 lg:px-16 lg:py-20 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse 60% 50% at 30% 40%, rgba(201,168,76,0.08) 0%, transparent 70%)" }}/>
            <div className="relative z-10 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-semibold"
                style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "#f0d06e" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f0d06e", display: "inline-block" }}/>
                FIRST VISIT SPECIAL
              </div>

              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black mb-4" style={{ color: "#ffffff", lineHeight: 1.1 }}>
                GET{" "}
                <span style={{ background: "linear-gradient(135deg, #c9a84c 0%, #f0d06e 50%, #c9a84c 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Rs.200 OFF
                </span>
                <br />YOUR FIRST<br />SALON VISIT
              </h1>

              <p className="text-base lg:text-lg mb-8 font-medium" style={{ color: "#9ca3af", maxWidth: 400 }}>
                Choose your service and claim your offer in 30 seconds.
                No payment required now.
              </p>

              <button id="hero-claim-btn" onClick={claimOffer}
                className="btn-primary btn-pulse hidden lg:inline-flex items-center gap-2 text-base px-8 py-4">
                CLAIM MY OFFER
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>

              <div className="flex items-center gap-6 mt-8 lg:mt-10">
                {[{ v: "2,400+", l: "Happy Clients" }, { v: "4.9", l: "Star Rating" }, { v: "8+", l: "Years" }].map(s => (
                  <div key={s.l}>
                    <div className="text-lg font-black" style={{ color: "#f0d06e" }}>{s.v}</div>
                    <div className="text-xs" style={{ color: "#4b5563" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Service picker */}
          <div className="lg:w-[500px] xl:w-[540px] flex flex-col px-5 py-8 lg:py-12 lg:px-10"
            style={{ background: "rgba(255,255,255,0.03)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>

            <div className="mb-4">
              <h2 className="text-lg font-black mb-1" style={{ color: "#ffffff" }}>Choose Your Service</h2>
              <p className="text-sm" style={{ color: highlightServices ? "#f0d06e" : "#6b7280" }}>
                {highlightServices ? "Pick a service below to continue" : "Select a service to see your first-visit price"}
              </p>
            </div>

            {/* Service cards — expanded pricing */}
            <div id="services-grid" className="flex flex-col gap-2 mb-6"
              style={{
                borderRadius: 14,
                transition: "box-shadow 0.3s ease",
                boxShadow: highlightServices ? "0 0 0 2px #c9a84c, 0 0 32px rgba(201,168,76,0.2)" : "none",
              }}>
              {SERVICES.map((svc) => {
                const isSelected = selectedService === svc.name;
                const firstVisitPrice = svc.price - DISCOUNT;
                return (
                  <button key={svc.name}
                    id={`service-${svc.name.replace(/\s+/g, "-").toLowerCase()}`}
                    onClick={() => { setSelectedService(svc.name); setHighlightServices(false); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left w-full transition-all"
                    style={{
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(201,168,76,0.18), rgba(240,208,110,0.1))"
                        : "rgba(255,255,255,0.04)",
                      border: isSelected ? "1.5px solid #c9a84c" : "1.5px solid rgba(255,255,255,0.07)",
                      cursor: "pointer",
                      boxShadow: isSelected ? "0 0 0 3px rgba(201,168,76,0.12)" : "none",
                    }}>
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: isSelected ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.06)" }}>
                      <ServiceIcon icon={svc.icon} size={18} color={isSelected ? "#f0d06e" : "#6b7280"} />
                    </div>

                    {/* Name + pricing */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: isSelected ? "#ffffff" : "#d1d5db" }}>
                        {svc.name}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {/* First visit price — prominent */}
                        <span className="text-sm font-black" style={{ color: "#c9a84c" }}>
                          Rs.{firstVisitPrice}
                        </span>
                        {/* Regular price — struck */}
                        <span className="text-xs line-through" style={{ color: "#4b5563" }}>
                          Rs.{svc.price}
                        </span>
                        {/* Savings badge */}
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: isSelected ? "rgba(201,168,76,0.25)" : "rgba(201,168,76,0.1)", color: "#f0d06e" }}>
                          Save Rs.200
                        </span>
                      </div>
                    </div>

                    {/* Selection tick */}
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isSelected ? "#c9a84c" : "transparent",
                        border: isSelected ? "none" : "2px solid rgba(255,255,255,0.15)",
                        color: "white",
                      }}>
                      {isSelected && <CheckIcon size={11} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <button id="claim-offer-btn" onClick={claimOffer}
              className="btn-primary btn-pulse w-full text-base py-4 mb-3"
              style={{ width: "100%", fontSize: 15 }}>
              {selectedService ? `Claim My Offer — ${selectedService}` : "CLAIM MY OFFER"}
            </button>
            {!selectedService && (
              <p className="text-center text-xs mb-3" style={{ color: "#4b5563" }}>
                Select a service above to continue
              </p>
            )}

            {/* Trust badges */}
            <div className="flex justify-center gap-4 pt-1">
              {[
                { icon: "shield", label: "No payment now" },
                { icon: "clock",  label: "30-sec claim"   },
                { icon: "check",  label: "Free cancel"    },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {b.icon === "shield" && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>}
                    {b.icon === "clock"  && <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
                    {b.icon === "check"  && <polyline points="20 6 9 17 4 12"/>}
                  </svg>
                  <span className="text-xs" style={{ color: "#4b5563" }}>{b.label}</span>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="mt-7 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#4b5563" }}>How it works</p>
              <div className="flex flex-col gap-3">
                {[
                  { n: "1", t: "Choose a service",   d: "Pick from the list above" },
                  { n: "2", t: "Claim your offer",    d: "Fill in details in 30 sec" },
                  { n: "3", t: "We call to confirm",  d: "Our team books your slot" },
                ].map(item => (
                  <div key={item.n} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
                      style={{ background: "rgba(201,168,76,0.15)", color: "#c9a84c" }}>
                      {item.n}
                    </div>
                    <div>
                      <span className="text-sm font-semibold" style={{ color: "#d1d5db" }}>{item.t}</span>
                      <span className="text-xs ml-2" style={{ color: "#4b5563" }}>{item.d}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile sticky CTA */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 px-4 py-4"
          style={{ background: "linear-gradient(to top, #0f0f1a 70%, transparent)", zIndex: 40 }}>
          <button id="claim-offer-btn-mobile" onClick={claimOffer}
            className="btn-primary btn-pulse w-full text-base py-4"
            style={{ width: "100%", borderRadius: 14 }}>
            {selectedService ? `Claim — ${selectedService}` : "CLAIM MY OFFER"}
          </button>
          <p className="text-center text-xs mt-2 pb-1" style={{ color: "#4b5563" }}>
            Rs.200 OFF &middot; No payment required now
          </p>
        </div>
        <div className="lg:hidden h-24"/>

        <div className="text-center py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-xs" style={{ color: "#374151" }}>&copy; 2026 Swasthik Salon &amp; Boutique</p>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // LEAD FORM
  // ══════════════════════════════════════════════════════════════════════════════
  if (step === "form") {
    const svc = SERVICES.find((s) => s.name === selectedService)!;
    const firstVisitPrice = svc.price - DISCOUNT;
    return (
      <main style={{ background: "#0f0f1a", minHeight: "100vh" }}>
        {/* Top bar */}
        <div style={{ background: "rgba(201,168,76,0.08)", borderBottom: "1px solid rgba(201,168,76,0.15)" }}
          className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => setStep("landing")}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ color: "#c9a84c", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.2)", cursor: "pointer" }}>
            &larr; Back
          </button>
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: "#c9a84c" }}>SWASTHIK SALON &amp; BOUTIQUE</p>
            <p className="text-white font-bold text-sm">Claim Your Offer</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start justify-center px-4 py-8 lg:py-12 gap-8 max-w-4xl mx-auto">

          {/* Offer summary sidebar */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,168,76,0.2)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#c9a84c" }}>Your Offer</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(201,168,76,0.15)" }}>
                  <ServiceIcon icon={svc.icon} size={22} color="#f0d06e" />
                </div>
                <div className="font-bold text-white">{svc.name}</div>
              </div>

              {/* Pricing breakdown */}
              <div className="rounded-xl p-3 mb-4 space-y-2"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "#6b7280" }}>Regular Price</span>
                  <span className="line-through" style={{ color: "#4b5563" }}>Rs.{svc.price}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span style={{ color: "#9ca3af" }}>First Visit Price</span>
                  <span style={{ color: "#f0d06e" }}>Rs.{firstVisitPrice}</span>
                </div>
                <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }}/>
                <div className="flex justify-between text-sm font-black">
                  <span style={{ color: "#c9a84c" }}>You Save</span>
                  <span style={{ color: "#c9a84c" }}>Rs.200</span>
                </div>
              </div>

              <div className="space-y-2">
                {["No payment needed now", "Our team confirms within 24h", "Free cancellation"].map(t => (
                  <div key={t} className="flex items-center gap-2 text-xs" style={{ color: "#6b7280" }}>
                    <div style={{ color: "#c9a84c", flexShrink: 0 }}><CheckIcon size={12} /></div>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 w-full">
            <h2 className="text-2xl font-black mb-1" style={{ color: "#ffffff" }}>Almost there!</h2>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>Tell us when you&apos;d like to visit.</p>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "#9ca3af" }}>Full Name *</label>
                <input id="input-name" type="text" placeholder="e.g. Priya Sharma" value={formData.name}
                  onChange={e => { setFormData({...formData, name: e.target.value}); setErrors({...errors, name: ""}); }}
                  className={`form-input ${errors.name ? "error" : ""}`}
                  style={{ background: "rgba(255,255,255,0.06)", borderColor: errors.name ? "#ef4444" : "rgba(255,255,255,0.1)", color: "#ffffff" }} />
                {errors.name && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.name}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "#9ca3af" }}>Mobile Number *</label>
                <input id="input-phone" type="tel" placeholder="10-digit mobile number" maxLength={10} value={formData.phone}
                  onChange={e => { const v = e.target.value.replace(/\D/g, ""); setFormData({...formData, phone: v}); setErrors({...errors, phone: ""}); }}
                  className={`form-input ${errors.phone ? "error" : ""}`}
                  style={{ background: "rgba(255,255,255,0.06)", borderColor: errors.phone ? "#ef4444" : "rgba(255,255,255,0.1)", color: "#ffffff" }} />
                {errors.phone && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.phone}</p>}
              </div>

              {/* Service — read-only */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "#9ca3af" }}>Selected Service</label>
                <input id="input-service" type="text" value={selectedService} readOnly
                  className="form-input"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)", color: "#6b7280", cursor: "default" }} />
              </div>

              {/* Date + Time side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: "#9ca3af" }}>Preferred Date *</label>
                  <input id="input-date" type="date" min={todayIso()} value={formData.preferredDate}
                    onChange={e => { setFormData({...formData, preferredDate: e.target.value}); setErrors({...errors, preferredDate: ""}); }}
                    className={`form-input ${errors.preferredDate ? "error" : ""}`}
                    style={{ background: "rgba(255,255,255,0.06)", borderColor: errors.preferredDate ? "#ef4444" : "rgba(255,255,255,0.1)", color: "#ffffff" }} />
                  {errors.preferredDate && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.preferredDate}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: "#9ca3af" }}>Preferred Time *</label>
                  <select id="input-time" value={formData.preferredTime}
                    onChange={e => { setFormData({...formData, preferredTime: e.target.value}); setErrors({...errors, preferredTime: ""}); }}
                    className={`form-input ${errors.preferredTime ? "error" : ""}`}
                    style={{ background: "rgba(255,255,255,0.06)", borderColor: errors.preferredTime ? "#ef4444" : "rgba(255,255,255,0.1)", color: formData.preferredTime ? "#ffffff" : "#6b7280" }}>
                    <option value="" style={{ background: "#1a1a2e" }}>Select time</option>
                    {TIME_SLOTS.map(t => (
                      <option key={t} value={t} style={{ background: "#1a1a2e", color: "#ffffff" }}>{t}</option>
                    ))}
                  </select>
                  {errors.preferredTime && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.preferredTime}</p>}
                </div>
              </div>

              <p className="text-xs italic" style={{ color: "#4b5563" }}>
                These are appointment preferences. Our team will confirm availability.
              </p>

              <button id="submit-form-btn" type="submit" disabled={isSubmitting}
                className="btn-primary w-full text-base py-4" style={{ width: "100%" }}>
                {isSubmitting ? "Submitting..." : "Request My Appointment"}
              </button>
              <p className="text-center text-xs" style={{ color: "#374151" }}>
                By submitting, you agree to be contacted by our team to confirm your appointment.
              </p>
            </form>
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SUCCESS PAGE
  // ══════════════════════════════════════════════════════════════════════════════
  if (step === "success" && submittedLead) {
    return (
      <main style={{ background: "#0f0f1a", minHeight: "100vh" }}
        className="flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-5 float-anim"
              style={{ background: "linear-gradient(135deg, #c9a84c, #f0d06e)" }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 className="text-3xl font-black mb-2" style={{ color: "#ffffff" }}>
              Appointment Request Received!
            </h1>
            <p style={{ color: "#6b7280" }}>Our team will contact you to confirm your appointment.</p>
          </div>

          {/* Confirmation card */}
          <div className="rounded-2xl p-6 mb-5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,168,76,0.2)" }}>
            <div className="text-center py-2 px-4 rounded-xl mb-5 text-xs font-bold tracking-widest uppercase"
              style={{ background: "rgba(201,168,76,0.12)", color: "#f0d06e", border: "1px solid rgba(201,168,76,0.2)" }}>
              Ref: {submittedLead.id}
            </div>
            <div className="space-y-3">
              {[
                { label: "Customer",        value: submittedLead.name },
                { label: "Service",         value: submittedLead.service },
                { label: "Preferred Date",  value: submittedLead.preferredDate },
                { label: "Preferred Time",  value: submittedLead.preferredTime },
                { label: "Offer",           value: OFFER_TEXT, gold: true },
              ].map(row => (
                <div key={row.label} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: "#c9a84c" }}/>
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: "#4b5563" }}>{row.label}</div>
                    <div className="text-sm font-semibold" style={{ color: row.gold ? "#f0d06e" : "#ffffff" }}>
                      {row.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!bookingMsg ? (
            <button id="book-appointment-btn" onClick={() => setBookingMsg(true)}
              className="btn-primary w-full mb-3" style={{ width: "100%" }}>
              Confirm My Appointment
            </button>
          ) : (
            <div className="w-full text-center py-4 px-5 rounded-xl mb-3 text-sm"
              style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div className="font-semibold mb-1">Request received!</div>
              <div className="text-xs" style={{ color: "#6b7280" }}>
                Our team will call you at {submittedLead.phone} to confirm the appointment.
              </div>
            </div>
          )}
          <button id="back-home-btn" onClick={goHome}
            className="btn-secondary w-full"
            style={{ width: "100%", borderColor: "rgba(201,168,76,0.3)", color: "#c9a84c" }}>
            &larr; Back to Home
          </button>
        </div>
      </main>
    );
  }

  return null;
}