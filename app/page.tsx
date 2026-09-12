"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SERVICES, DISCOUNT, OFFER_TEXT } from "./lib/services";
import { insertLead } from "./lib/supabase";
import { Lead, LeadStatus } from "./types";

// ─── Date helpers ─────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDateSafe(isoValue: string): string {
  if (!isoValue || isoValue === "-") return "-";
  if (/^\d{1,2}\s[A-Za-z]{3}\s\d{4}$/.test(isoValue.trim())) return isoValue.trim();
  const parts = isoValue.split("-").map(Number);
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const [y, m, d] = parts;
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }
  return isoValue;
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
  const [selectedService, setSelectedService] = useState<string>("Hair Spa");
  const [submittedLead, setSubmittedLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", preferredDate: "", preferredTime: "11:00 AM" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
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
      } else {
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

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSubmitting(true);

    try {
      const activeSvc = SERVICES.find(s => s.name.toLowerCase() === (selectedService || "Hair Spa").toLowerCase());
      const regularPrice = activeSvc ? activeSvc.price : 999;
      const offerPrice = Math.max(0, regularPrice - DISCOUNT);

      const lead = await insertLead({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        service: selectedService || "Hair Spa",
        regularPrice,
        offerPrice,
        discountAmount: DISCOUNT,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        source: utmData.source,
        medium: utmData.medium,
        campaign: utmData.campaign,
        status: "Booking Requested",
      });

      setSubmittedLead(lead);
      setIsSubmitting(false);
      setStep("success");
    } catch (err: any) {
      console.error("Lead submission error:", err);
      setIsSubmitting(false);
      setSubmitError("Unable to submit your request right now. Please try again.");
    }
  }

  function goHome() {
    setStep("landing");
    setFormData({ name: "", phone: "", preferredDate: "", preferredTime: "11:00 AM" });
    setErrors({});
    setSubmitError("");
    setSubmittedLead(null);
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
  // 1. LANDING PAGE
  // ══════════════════════════════════════════════════════════════════════════════
  if (step === "landing") {
    return (
      <main style={{ background: "#0f0f1a", minHeight: "100vh" }}>

        {/* Top bar */}
        <div style={{ background: "rgba(201,168,76,0.08)", borderBottom: "1px solid rgba(201,168,76,0.15)" }}
          className="px-4 py-2.5 sm:px-6 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Swasthik Salon & Boutique Logo"
              className="w-9 h-9 rounded-full object-cover border border-amber-400/40 shadow-sm flex-shrink-0" />
            <div>
              <span className="text-xs sm:text-sm font-bold tracking-wider text-amber-300 block leading-tight">
                SWASTHIK SALON &amp; BOUTIQUE
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: "rgba(201,168,76,0.15)", color: "#f0d06e", border: "1px solid rgba(201,168,76,0.25)" }}>
              &#9733; 4.9 Rated
            </div>
            <a href="tel:+918501020553" id="customer-call-btn"
              className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.15)" }}>
              &#128222; Call Salon
            </a>
          </div>
        </div>

        {/* Responsive Content Container */}
        <div className="flex flex-col lg:flex-row max-w-6xl mx-auto" style={{ minHeight: "calc(100vh - 49px)" }}>

          {/* LEFT: Offer Hero */}
          <div className="lg:flex-1 flex flex-col justify-center px-4 py-6 sm:px-8 lg:px-12 lg:py-16">
            <div className="flex items-center gap-3 mb-3">
              <img src="/logo.png" alt="Swasthik Salon Logo"
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400/50 shadow-md flex-shrink-0" />
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "#f0d06e" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f0d06e", display: "inline-block" }}/>
                FIRST VISIT SPECIAL
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-2 text-white leading-tight">
              GET{" "}
              <span style={{ background: "linear-gradient(135deg, #c9a84c 0%, #f0d06e 50%, #c9a84c 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                &#8377;200 OFF
              </span>
              <br />YOUR FIRST VISIT
            </h1>

            <p className="text-xs sm:text-sm text-gray-400 mb-4 max-w-md">
              Select your service below to claim your ₹200 discount. No payment required.
            </p>

            <div className="hidden lg:flex items-center gap-6 mt-4">
              {[{ v: "1,400+", l: "Happy Clients" }, { v: "4.9★", l: "Top Rated" }, { v: "10+ Yrs", l: "Experience" }].map(s => (
                <div key={s.l}>
                  <div className="text-base font-black text-amber-300">{s.v}</div>
                  <div className="text-[11px] text-gray-500">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Service Picker */}
          <div className="lg:w-[460px] xl:w-[480px] flex flex-col justify-center px-4 py-4 sm:px-6 lg:py-10"
            style={{ background: "rgba(255,255,255,0.02)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>

            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Choose Service</h2>
              <span className="text-xs font-semibold text-amber-400">Save &#8377;200 on each</span>
            </div>

            {/* Service Cards List */}
            <div id="services-grid" className="flex flex-col gap-2 mb-3">
              {SERVICES.map((svc) => {
                const isSelected = selectedService === svc.name;
                const firstVisitPrice = svc.price - DISCOUNT;
                return (
                  <button
                    key={svc.name}
                    id={`service-${svc.name.replace(/\s+/g, "-").toLowerCase()}`}
                    onClick={() => { setSelectedService(svc.name); setHighlightServices(false); }}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left w-full transition-all"
                    style={{
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(201,168,76,0.18), rgba(240,208,110,0.1))"
                        : "rgba(255,255,255,0.03)",
                      border: isSelected ? "1.5px solid #c9a84c" : "1.5px solid rgba(255,255,255,0.07)",
                      cursor: "pointer",
                      boxShadow: isSelected ? "0 0 0 2px rgba(201,168,76,0.15)" : "none",
                    }}>
                    
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: isSelected ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.05)" }}>
                      <ServiceIcon icon={svc.icon} size={16} color={isSelected ? "#f0d06e" : "#9ca3af"} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold" style={{ color: isSelected ? "#ffffff" : "#d1d5db" }}>
                        {svc.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-black text-amber-400">
                          &#8377;{firstVisitPrice}
                        </span>
                        <span className="text-[11px] line-through text-gray-500">
                          &#8377;{svc.price}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300">
                          Save &#8377;200
                        </span>
                      </div>
                    </div>

                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isSelected ? "#c9a84c" : "transparent",
                        border: isSelected ? "none" : "1.5px solid rgba(255,255,255,0.2)",
                        color: "white",
                      }}>
                      {isSelected && <CheckIcon size={10} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* SINGLE Prominent CTA Button on Mobile and Desktop */}
            <button
              id="claim-offer-btn"
              onClick={claimOffer}
              className="btn-primary btn-pulse w-full text-sm sm:text-base font-bold py-3.5 rounded-xl shadow-lg"
              style={{ width: "100%" }}>
              CLAIM &#8377;200 OFF &bull; {selectedService} &rarr;
            </button>

            {/* Micro trust indicators */}
            <div className="flex justify-center items-center gap-4 pt-2.5 text-[11px] text-gray-500">
              <span>&#10003; 30-Sec Booking</span>
              <span>&bull;</span>
              <span>&#10003; No Payment Now</span>
              <span>&bull;</span>
              <span>&#10003; Free Reschedule</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. LEAD FORM (Non-scrollable, fits 100% in mobile screen)
  // ══════════════════════════════════════════════════════════════════════════════
  if (step === "form") {
    const svc = SERVICES.find((s) => s.name === selectedService) || SERVICES[0];
    const firstVisitPrice = svc.price - DISCOUNT;

    return (
      <main style={{ background: "#0f0f1a", minHeight: "100dvh" }}
        className="flex flex-col justify-between px-4 py-3 sm:py-6 max-w-lg mx-auto overflow-hidden">
        
        {/* Compact Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <button onClick={() => setStep("landing")}
            className="text-xs px-2.5 py-1 rounded-lg font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 cursor-pointer">
            &larr; Change Service
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Swasthik Logo"
              className="w-7 h-7 rounded-full object-cover border border-amber-400/40 shadow-sm" />
            <div className="text-right">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest block leading-tight">
                SWASTHIK SALON
              </span>
              <span className="text-xs font-bold text-white leading-tight">Claim &#8377;200 OFF</span>
            </div>
          </div>
        </div>

        {/* Selected Service Pill */}
        <div className="my-2.5 p-2.5 rounded-xl flex items-center justify-between"
          style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-400/20 text-amber-300">
              <ServiceIcon icon={svc.icon} size={16} color="#f0d06e" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{svc.name}</div>
              <div className="text-[11px] text-gray-400">Regular: <span className="line-through">&#8377;{svc.price}</span></div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-black text-amber-400">&#8377;{firstVisitPrice}</div>
            <div className="text-[10px] font-bold text-emerald-400">You Save &#8377;200</div>
          </div>
        </div>

        {/* Compact Single-Screen Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2.5 flex-1 justify-center">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Your Name *
            </label>
            <input
              id="input-name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors({ ...errors, name: "" }); }}
              className={`form-input py-2 px-3 text-xs rounded-xl ${errors.name ? "error" : ""}`}
              style={{ background: "rgba(255,255,255,0.06)", borderColor: errors.name ? "#ef4444" : "rgba(255,255,255,0.1)", color: "#ffffff" }}
            />
            {errors.name && <p className="text-[10px] text-red-400 mt-0.5">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Mobile Number *
            </label>
            <input
              id="input-phone"
              type="tel"
              placeholder="10-digit mobile number"
              maxLength={10}
              value={formData.phone}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setFormData({ ...formData, phone: v });
                setErrors({ ...errors, phone: "" });
              }}
              className={`form-input py-2 px-3 text-xs rounded-xl ${errors.phone ? "error" : ""}`}
              style={{ background: "rgba(255,255,255,0.06)", borderColor: errors.phone ? "#ef4444" : "rgba(255,255,255,0.1)", color: "#ffffff" }}
            />
            {errors.phone && <p className="text-[10px] text-red-400 mt-0.5">{errors.phone}</p>}
          </div>

          {/* Date & Time Grid — Non-overlapping layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 min-w-0">
            <div className="min-w-0">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Preferred Date *
              </label>
              <input
                id="input-date"
                type="date"
                min={todayIso()}
                value={formData.preferredDate}
                onChange={(e) => { setFormData({ ...formData, preferredDate: e.target.value }); setErrors({ ...errors, preferredDate: "" }); }}
                className={`form-input py-2 px-2.5 text-xs rounded-xl w-full min-w-0 block ${errors.preferredDate ? "error" : ""}`}
                style={{ background: "rgba(255,255,255,0.06)", borderColor: errors.preferredDate ? "#ef4444" : "rgba(255,255,255,0.1)", color: "#ffffff", boxSizing: "border-box" }}
              />
              {errors.preferredDate && <p className="text-[10px] text-red-400 mt-0.5">{errors.preferredDate}</p>}
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Preferred Time *
              </label>
              <select
                id="input-time"
                value={formData.preferredTime}
                onChange={(e) => { setFormData({ ...formData, preferredTime: e.target.value }); setErrors({ ...errors, preferredTime: "" }); }}
                className={`form-input py-2 px-2.5 text-xs rounded-xl w-full min-w-0 block ${errors.preferredTime ? "error" : ""}`}
                style={{ background: "rgba(255,255,255,0.06)", borderColor: errors.preferredTime ? "#ef4444" : "rgba(255,255,255,0.1)", color: "#ffffff", boxSizing: "border-box" }}>
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t} style={{ background: "#1a1a2e", color: "#ffffff" }}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Message Banner */}
          {submitError && (
            <div id="submit-error-banner" className="p-2.5 rounded-xl text-xs font-semibold text-center bg-red-500/15 border border-red-500/40 text-red-300">
              {submitError}
            </div>
          )}

          {/* ONE Single Submit Button */}
          <div className="mt-1">
            <button
              id="submit-form-btn"
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full text-sm font-bold py-3.5 rounded-xl shadow-lg"
              style={{ width: "100%" }}>
              {isSubmitting ? "Locking Your Offer..." : "Claim \u20B9200 OFF & Confirm Booking \u2192"}
            </button>
            <p className="text-center text-[10px] text-gray-500 mt-1.5">
              1-click instant confirmation &bull; No advance payment needed
            </p>
          </div>
        </form>

        <div className="text-center pt-2 text-[10px] text-gray-600 border-t border-white/5">
          &copy; Swasthik Salon &amp; Boutique &bull; 100% Privacy Guaranteed
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. SUCCESS / CONFIRMATION PAGE (Directly confirmed, NO 2nd button!)
  // ══════════════════════════════════════════════════════════════════════════════
  if (step === "success" && submittedLead) {
    return (
      <main style={{ background: "#0f0f1a", minHeight: "100dvh" }}
        className="flex flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-sm">
          
          {/* Instant Confirmation Header */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-3 mb-3">
              <img src="/logo.png" alt="Swasthik Logo"
                className="w-14 h-14 rounded-full object-cover border-2 border-amber-400/50 shadow-md" />
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 0 25px rgba(16,185,129,0.35)" }}>
                <CheckIcon size={24} />
              </div>
            </div>
            <h1 className="text-2xl font-black text-white mb-1">
              Appointment Confirmed!
            </h1>
            <p className="text-xs text-emerald-400 font-semibold">
              &#10003; Your &#8377;200 OFF First Visit Offer is locked in.
            </p>
          </div>

          {/* Booking Summary Card */}
          <div className="rounded-2xl p-4 mb-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,168,76,0.25)" }}>
            <div className="text-center py-1.5 px-3 rounded-lg mb-3 text-xs font-bold tracking-widest uppercase"
              style={{ background: "rgba(201,168,76,0.15)", color: "#f0d06e", border: "1px solid rgba(201,168,76,0.2)" }}>
              Booking Ref: {submittedLead.id}
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Customer</span>
                <span className="font-bold text-white">{submittedLead.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Service</span>
                <span className="font-bold text-white">{submittedLead.service}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-gray-400">Date &amp; Time</span>
                <span className="font-bold text-amber-300">
                  {formatDateSafe(submittedLead.preferredDate)} at {submittedLead.preferredTime}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-400">Special Offer</span>
                <span className="font-black text-emerald-400">&#8377;200 OFF Applied</span>
              </div>
            </div>
          </div>

          {/* Immediate Next Step Message */}
          <div className="w-full text-center py-3 px-4 rounded-xl mb-4 text-xs leading-relaxed"
            style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
            Our team will call you at <strong>{submittedLead.phone}</strong> to welcome you!
          </div>

          {/* Single Return Button */}
          <button
            id="back-home-btn"
            onClick={goHome}
            className="btn-secondary w-full text-xs font-bold py-3 rounded-xl"
            style={{ width: "100%", borderColor: "rgba(201,168,76,0.3)", color: "#c9a84c" }}>
            &larr; Back to Home
          </button>

        </div>
      </main>
    );
  }

  return null;
}