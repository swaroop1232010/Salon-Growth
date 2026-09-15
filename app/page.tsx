"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SERVICES, STANDARD_SERVICES, STUDENT_OFFER, DISCOUNT } from "./lib/services";
import { insertLead, checkPhoneClaimed, fetchActiveOffers } from "./lib/supabase";
import { Lead, LeadStatus, Service } from "./types";

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
    case "scissors": // Advanced Haircut
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>;
    case "facial": // Fruit Facial + D-Tan
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M12 2c0 0 3-1 4 2"/></svg>;
    case "nails": // Basic Pedi + Mani
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
    case "waxing": // Full Hands + Half Legs Waxing
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 8.5H3l5.5 4-2 6.5L12 15l5.5 4-2-6.5L21 8.5h-6.5L12 2z"/></svg>;
    case "student": // Students flat 50%
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
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
  const [allServices, setAllServices] = useState<Service[]>(SERVICES);
  const [selectedService, setSelectedService] = useState<string>(SERVICES[0]?.name || "Advanced Haircut");
  const [submittedLead, setSubmittedLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", preferredDate: "", preferredTime: "11:00 AM" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [utmData, setUtmData] = useState<UtmData>({ source: "Direct", medium: "", campaign: "" });
  const [highlightServices, setHighlightServices] = useState(false);
  const [minDate, setMinDate] = useState("");

  const standardServices = allServices.filter((s) => !s.isSpecial);
  const studentOffer = allServices.find((s) => s.isSpecial) || STUDENT_OFFER;

  useEffect(() => {
    setMinDate(todayIso());

    // Fetch live active offers from Supabase
    fetchActiveOffers().then((active) => {
      if (active && active.length > 0) {
        setAllServices(active);
      }
    });

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
      const activeSvc = allServices.find(s => s.name.toLowerCase() === (selectedService || "").toLowerCase()) || allServices[0];
      const regularPrice = activeSvc.price;
      const discountAmount = activeSvc.discountAmount ?? DISCOUNT;
      const offerPrice = activeSvc.offerPrice ?? Math.max(0, regularPrice - discountAmount);
      const cleanPhone = formData.phone.trim().replace(/\D/g, "").slice(-10);
      const campaign = utmData.campaign || activeSvc.campaignSlug || "first-visit-special";
      const policy = activeSvc.policy || "new_customers_only";

      // 1. Instant client-side check
      if (typeof window !== "undefined") {
        const localKey = policy === "once_per_campaign"
          ? `sgs_claimed_${campaign}_phones`
          : "sgs_claimed_phones";
        const locallyClaimed = JSON.parse(localStorage.getItem(localKey) || "[]");
        if (locallyClaimed.includes(cleanPhone)) {
          const msg = policy === "once_per_campaign"
            ? "This mobile number has already claimed this campaign offer."
            : "This mobile number has already claimed this offer. Only 1 offer is allowed per customer.";
          setErrors(prev => ({ ...prev, phone: msg }));
          setSubmitError(msg);
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Real-time DB lookup
      const isAlreadyClaimed = await checkPhoneClaimed(cleanPhone, campaign, policy);
      if (isAlreadyClaimed) {
        const msg = policy === "once_per_campaign"
          ? "This mobile number has already claimed this campaign offer."
          : "This mobile number has already claimed this offer. Only 1 offer is allowed per customer.";
        setErrors(prev => ({ ...prev, phone: msg }));
        setSubmitError(msg);
        setIsSubmitting(false);
        return;
      }

      const lead = await insertLead({
        name: formData.name.trim(),
        phone: cleanPhone,
        service: selectedService || activeSvc.name,
        regularPrice,
        offerPrice,
        discountAmount,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        source: utmData.source,
        medium: utmData.medium,
        campaign,
        policy,
        status: "Booking Requested",
      });

      // Save to localStorage on successful claim
      if (typeof window !== "undefined") {
        const localKey = policy === "once_per_campaign"
          ? `sgs_claimed_${campaign}_phones`
          : "sgs_claimed_phones";
        const locallyClaimed = JSON.parse(localStorage.getItem(localKey) || "[]");
        if (!locallyClaimed.includes(cleanPhone)) {
          locallyClaimed.push(cleanPhone);
          localStorage.setItem(localKey, JSON.stringify(locallyClaimed));
        }
      }

      setSubmittedLead(lead);
      setIsSubmitting(false);
      setStep("success");
    } catch (err: unknown) {
      setIsSubmitting(false);
      const errorMsg = err instanceof Error ? err.message : "Unable to submit your request right now. Please try again.";
      if (errorMsg.toLowerCase().includes("already claimed")) {
        setErrors(prev => ({ ...prev, phone: errorMsg }));
      }
      setSubmitError(errorMsg);
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
      <main className="h-[100dvh] max-h-[100dvh] overflow-y-auto lg:overflow-hidden flex flex-col justify-between" style={{ background: "#0f0f1a" }}>

        {/* Top bar */}
        <div
          className="flex-shrink-0 px-4 py-2 sm:px-6 sm:py-2.5 flex items-center justify-between gap-2"
          style={{ background: "rgba(201,168,76,0.08)", borderBottom: "1px solid rgba(201,168,76,0.15)" }}
        >
          {/* Left — logo + name (never wraps) */}
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/logo.png"
              alt="Swasthik Salon &amp; Boutique Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-amber-400/40 shadow-sm flex-shrink-0"
            />
            <span className="text-[11px] sm:text-xs font-bold tracking-wider text-amber-300 whitespace-nowrap leading-tight">
              SWASTHIK SALON &amp; BOUTIQUE
            </span>
          </div>
          {/* Right — rating (hidden on mobile) + Call button */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div
              className="hidden sm:block text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: "rgba(201,168,76,0.15)", color: "#f0d06e", border: "1px solid rgba(201,168,76,0.25)" }}
            >
              &#9733; 4.9 Rated
            </div>
            <a
              href="tel:+919110365226"
              id="customer-call-btn"
              className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap"
              style={{ background: "rgba(255,255,255,0.08)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              &#128222;
              <span className="sm:inline">Call Salon</span>
            </a>
          </div>
        </div>


        {/* Responsive Content Container - Non-scrollable on Desktop */}
        <div className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full items-center justify-between px-4 sm:px-6 lg:px-8 py-2 lg:py-0 overflow-y-auto lg:overflow-hidden">

          {/* LEFT: Hero Offer */}
          <div className="lg:flex-1 flex flex-col justify-center px-2 py-3 sm:px-6 lg:px-8 lg:py-6 max-w-xl">
            {/* Header Badge */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <img
                src="/logo.png"
                alt="Swasthik Salon Logo"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-amber-400/50 shadow-md flex-shrink-0"
              />
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "#f0d06e" }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f0d06e", display: "inline-block" }} />
                FIRST VISIT SPECIAL
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-2 text-white leading-tight tracking-tight">
              GET{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #c9a84c 0%, #f0d06e 50%, #c9a84c 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                &#8377;200 OFF
              </span>
              <br />YOUR FIRST VISIT
            </h1>

            <p className="text-xs sm:text-sm text-gray-400 mb-3 max-w-md leading-relaxed">
              Select your service below to claim your &#8377;200 discount. No payment required.
            </p>

            {/* Students offer simple line */}
            <div
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs max-w-md mb-4"
              style={{
                background: "linear-gradient(135deg, rgba(147,51,234,0.14), rgba(201,168,76,0.08))",
                border: "1px solid rgba(168,85,247,0.3)",
                color: "#e9d5ff",
              }}
            >
              <span className="text-base flex-shrink-0">&#127891;</span>
              <span className="leading-tight">
                <strong className="text-white">Students:</strong> Get <strong className="text-amber-300">Flat 40% OFF</strong> with ID + <strong className="text-amber-300">10% Extra</strong> on Google Review!
              </span>
            </div>

            {/* Social Proof Stats */}
            <div className="flex items-center gap-6 mt-1">
              {[
                { v: "8,400+", l: "Happy Clients" },
                { v: "4.9★", l: "Top Rated" },
                { v: "15+ Yrs", l: "Experience" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-sm sm:text-base font-black text-amber-300">{s.v}</div>
                  <div className="text-[10px] sm:text-[11px] text-gray-500">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Service Picker — Large, high-contrast, crystal clear for poor eyesight */}
          <div className="lg:w-[500px] xl:w-[540px] flex flex-col justify-center px-4 py-3 sm:px-6 lg:py-4"
            style={{ background: "rgba(255,255,255,0.02)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>

            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>✨</span> Choose Service
              </h2>
              <span className="text-xs sm:text-sm font-extrabold text-amber-300 bg-amber-400/15 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                Save ₹200 on Combos
              </span>
            </div>

            {/* 4 Curated Combo Cards */}
            <div id="services-grid" className="flex flex-col gap-2 mb-2.5">
              {standardServices.map((svc) => {
                const isSelected = selectedService === svc.name;
                const discountAmount = svc.discountAmount ?? DISCOUNT;
                const offerPrice = svc.offerPrice ?? Math.max(0, svc.price - discountAmount);
                const badgeText = svc.badge ?? `Save ₹${discountAmount}`;
                return (
                  <button
                    key={svc.id || svc.name}
                    id={`service-${svc.name.replace(/\s+/g, "-").toLowerCase()}`}
                    onClick={() => { setSelectedService(svc.name); setHighlightServices(false); }}
                    className="flex items-center gap-3 px-3.5 py-2.5 sm:py-3 rounded-2xl text-left w-full transition-all"
                    style={{
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(201,168,76,0.22), rgba(240,208,110,0.12))"
                        : "rgba(255,255,255,0.04)",
                      border: isSelected ? "2px solid #f0d06e" : "1.5px solid rgba(255,255,255,0.1)",
                      cursor: "pointer",
                      boxShadow: isSelected ? "0 0 16px rgba(201,168,76,0.25)" : "none",
                    }}>
                    
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: isSelected ? "rgba(201,168,76,0.3)" : "rgba(255,255,255,0.06)" }}>
                      <ServiceIcon icon={svc.icon} size={22} color={isSelected ? "#f0d06e" : "#d1d5db"} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm sm:text-base font-black leading-tight" style={{ color: isSelected ? "#ffffff" : "#f3f4f6" }}>
                        {svc.name}
                      </div>
                      {svc.subtitle && (
                        <div className="text-xs sm:text-sm font-medium mt-0.5" style={{ color: isSelected ? "#fef08a" : "#9ca3af" }}>
                          {svc.subtitle}
                        </div>
                      )}
                      <div className="flex items-center gap-2.5 mt-1">
                        <span className="text-lg sm:text-xl font-black text-amber-300">
                          &#8377;{offerPrice}
                        </span>
                        <span className="text-xs sm:text-sm line-through text-gray-400 font-bold">
                          &#8377;{svc.price}
                        </span>
                        <span className="text-xs font-black px-2 py-0.5 rounded-md bg-amber-400 text-gray-950 shadow-xs">
                          {badgeText}
                        </span>
                      </div>
                    </div>

                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isSelected ? "#f0d06e" : "transparent",
                        border: isSelected ? "none" : "2px solid rgba(255,255,255,0.3)",
                        color: "#1a1a2e",
                      }}>
                      {isSelected && <CheckIcon size={14} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* DEDICATED STUDENT OFFER DISPLAY (Distinct & Apart from the 4 services) */}
            {(() => {
              const isSelected = selectedService === studentOffer.name;
              return (
                <div className="mb-2.5">
                  <div className="flex items-center gap-2 mb-1.5 mt-0.5">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-purple-500/40 to-amber-400/30" />
                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/40 flex items-center gap-1">
                      <span>🎓</span> Student Exclusive
                    </span>
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-purple-500/40 to-amber-400/30" />
                  </div>

                  <button
                    id="service-student-special"
                    onClick={() => { setSelectedService(studentOffer.name); setHighlightServices(false); }}
                    className="w-full text-left p-3 sm:p-3.5 rounded-2xl transition-all relative overflow-hidden"
                    style={{
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(147,51,234,0.3), rgba(201,168,76,0.22))"
                        : "linear-gradient(135deg, rgba(147,51,234,0.12), rgba(201,168,76,0.08))",
                      border: isSelected
                        ? "2px solid #f0d06e"
                        : "1.5px solid rgba(168,85,247,0.45)",
                      boxShadow: isSelected
                        ? "0 0 20px rgba(168,85,247,0.35), inset 0 0 12px rgba(240,208,110,0.15)"
                        : "none",
                      cursor: "pointer",
                    }}>
                    
                    {/* Top Row: Title + Badges */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: isSelected ? "rgba(168,85,247,0.45)" : "rgba(168,85,247,0.25)" }}>
                          <ServiceIcon icon="student" size={22} color={isSelected ? "#f0d06e" : "#e9d5ff"} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-black text-white leading-tight">
                            Students Flat 40% + 10% Extra
                          </div>
                          <div className="text-xs sm:text-sm text-purple-200 font-semibold leading-tight mt-0.5">
                            Valid on ALL salon services
                          </div>
                        </div>
                      </div>

                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isSelected ? "#f0d06e" : "transparent",
                          border: isSelected ? "none" : "2px solid rgba(255,255,255,0.3)",
                          color: "#1a1a2e",
                        }}>
                        {isSelected && <CheckIcon size={14} />}
                      </div>
                    </div>

                    {/* Offer breakdown chips */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-purple-500/25">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-500/25 text-purple-100 border border-purple-500/40">
                        Flat 40% OFF with Student ID
                      </span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-400/25 text-amber-200 border border-amber-400/40">
                        +10% on Google Review ⭐
                      </span>
                    </div>
                  </button>
                </div>
              );
            })()}

            {/* SINGLE Prominent CTA Button on Mobile and Desktop */}
            {(() => {
              const activeSvc = allServices.find(s => s.name === selectedService) || allServices[0];
              const isStudent = activeSvc.name === studentOffer.name;
              const ctaText = isStudent
                ? "CLAIM 40% + 10% STUDENT OFFER →"
                : `CLAIM ₹${activeSvc.discountAmount ?? 200} OFF • ${selectedService} →`;
              return (
                <button
                  id="claim-offer-btn"
                  onClick={claimOffer}
                  className="btn-primary btn-pulse w-full text-sm sm:text-base font-black py-3.5 sm:py-4 rounded-2xl shadow-xl"
                  style={{ width: "100%" }}>
                  {ctaText}
                </button>
              );
            })()}

            {/* Micro trust indicators */}
            <div className="flex justify-center items-center gap-3 pt-2 text-xs sm:text-sm font-semibold text-gray-400">
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
  // 2. LEAD FORM (Large, high-contrast, crystal clear for poor eyesight)
  // ══════════════════════════════════════════════════════════════════════════════
  if (step === "form") {
    const svc = allServices.find((s) => s.name === selectedService) || allServices[0];
    const discountAmount = svc.discountAmount ?? DISCOUNT;
    const offerPrice = svc.offerPrice ?? Math.max(0, svc.price - discountAmount);
    const badgeText = svc.badge ?? `Save ₹${discountAmount}`;

    return (
      <main style={{ background: "#0c0c16" }}
        className="h-[100dvh] max-h-[100dvh] overflow-y-auto lg:overflow-hidden flex items-center justify-center px-4 py-4">
        
        {/* Luxury Glass Form Card — Expanded to max-w-xl with large clear typography */}
        <div className="w-full max-w-xl rounded-3xl p-5 sm:p-7 relative"
          style={{
            background: "rgba(20, 20, 35, 0.98)",
            border: "1.5px solid rgba(201,168,76,0.35)",
            boxShadow: "0 30px 70px rgba(0,0,0,0.7), 0 0 40px rgba(201,168,76,0.12)",
          }}>
          
          {/* Card Top Nav */}
          <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/10">
            <button
              onClick={() => setStep("landing")}
              className="flex items-center gap-2 text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl text-amber-300 bg-amber-400/15 border border-amber-400/30 hover:bg-amber-400/25 transition-all cursor-pointer">
              &larr; <span>Back to Services</span>
            </button>
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Swasthik Logo"
                className="w-8 h-8 rounded-full object-cover border border-amber-400/40" />
              <span className="text-xs sm:text-sm font-black text-amber-300 tracking-wider">
                SWASTHIK SALON
              </span>
            </div>
          </div>

          {/* Unified Offer & Selected Service Header — Big & Visible */}
          <div className="rounded-2xl p-4 mb-4"
            style={{
              background: svc.isSpecial
                ? "linear-gradient(135deg, rgba(147,51,234,0.25), rgba(201,168,76,0.15))"
                : "linear-gradient(135deg, rgba(201,168,76,0.2), rgba(255,255,255,0.05))",
              border: svc.isSpecial
                ? "1.5px solid rgba(168,85,247,0.4)"
                : "1.5px solid rgba(201,168,76,0.35)",
            }}>
            
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: svc.isSpecial ? "rgba(168,85,247,0.35)" : "rgba(201,168,76,0.25)" }}>
                  <ServiceIcon icon={svc.icon} size={22} color="#f0d06e" />
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-black text-white truncate">
                    {svc.name}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-200 font-semibold truncate">
                    {svc.isSpecial ? "Flat 40% (Student ID) + 10% (Review)" : `Regular Price: ₹${svc.price}`}
                  </div>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-lg sm:text-2xl font-black text-amber-300">
                  {svc.isSpecial ? "40% + 10% OFF" : `₹${offerPrice}`}
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-emerald-300">
                  {svc.isSpecial ? "All Services" : badgeText}
                </div>
              </div>
            </div>

            {/* Quick Cross-Offer Switcher Link */}
            <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs sm:text-sm font-semibold">
              {!svc.isSpecial ? (
                <>
                  <span className="text-purple-200">🎓 Are you a student?</span>
                  <button
                    type="button"
                    onClick={() => setSelectedService(studentOffer.name)}
                    className="font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer">
                    Switch to Student Offer &rarr;
                  </button>
                </>
              ) : (
                <>
                  <span className="text-amber-200">✨ Regular guest?</span>
                  <button
                    type="button"
                    onClick={() => setSelectedService(standardServices[0]?.name || "Advanced Haircut")}
                    className="font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer">
                    Switch to ₹200 OFF Combos &rarr;
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Form with Large, Readable Fields for Poor Eyesight */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 sm:gap-3.5">
            {/* Name */}
            <div>
              <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 mb-1">
                Your Full Name *
              </label>
              <input
                id="input-name"
                type="text"
                placeholder="e.g. Priya Sharma"
                value={formData.name}
                onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors({ ...errors, name: "" }); }}
                className={`form-input text-base sm:text-lg font-semibold py-3 sm:py-3.5 px-4 rounded-xl ${errors.name ? "error" : ""}`}
              />
              {errors.name && <p className="text-xs font-bold text-red-400 mt-1">{errors.name}</p>}
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 mb-1">
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
                  setSubmitError("");
                }}
                onBlur={async () => {
                  const p = formData.phone.replace(/\D/g, "").slice(-10);
                  if (p.length === 10) {
                    const activeSvc = allServices.find(s => s.name === selectedService) || allServices[0];
                    const campaign = utmData.campaign || activeSvc.campaignSlug || "first-visit-special";
                    const policy = activeSvc.policy || "new_customers_only";

                    if (typeof window !== "undefined") {
                      const localKey = policy === "once_per_campaign"
                        ? `sgs_claimed_${campaign}_phones`
                        : "sgs_claimed_phones";
                      const local = JSON.parse(localStorage.getItem(localKey) || "[]");
                      if (local.includes(p)) {
                        const msg = policy === "once_per_campaign"
                          ? "This mobile number has already claimed this campaign offer."
                          : "This mobile number has already claimed this offer.";
                        setErrors(prev => ({ ...prev, phone: msg }));
                        return;
                      }
                    }
                    const isClaimed = await checkPhoneClaimed(p, campaign, policy);
                    if (isClaimed) {
                      const msg = policy === "once_per_campaign"
                        ? "This mobile number has already claimed this campaign offer."
                        : "This mobile number has already claimed this offer.";
                      setErrors(prev => ({ ...prev, phone: msg }));
                    }
                  }
                }}
                className={`form-input text-base sm:text-lg font-bold tracking-wider py-3 sm:py-3.5 px-4 rounded-xl ${errors.phone ? "error" : ""}`}
              />
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 font-medium">
                <span>🔒</span> 1 offer per customer &bull; Mobile number cannot be reused to reclaim.
              </p>
              {errors.phone && <p className="text-xs font-bold text-red-400 mt-1">{errors.phone}</p>}
            </div>

            {/* Date & Time Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 mb-1">
                  Visit Date *
                </label>
                <input
                  id="input-date"
                  type="date"
                  min={minDate || undefined}
                  suppressHydrationWarning
                  value={formData.preferredDate}
                  onChange={(e) => { setFormData({ ...formData, preferredDate: e.target.value }); setErrors({ ...errors, preferredDate: "" }); }}
                  className={`form-input text-base sm:text-lg font-semibold py-3 sm:py-3.5 px-4 rounded-xl w-full ${errors.preferredDate ? "error" : ""}`}
                />
                {errors.preferredDate && <p className="text-xs font-bold text-red-400 mt-1">{errors.preferredDate}</p>}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 mb-1">
                  Time Slot *
                </label>
                <select
                  id="input-time"
                  value={formData.preferredTime}
                  onChange={(e) => { setFormData({ ...formData, preferredTime: e.target.value }); setErrors({ ...errors, preferredTime: "" }); }}
                  className={`form-input text-base sm:text-lg font-semibold py-3 sm:py-3.5 px-4 rounded-xl w-full ${errors.preferredTime ? "error" : ""}`}>
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t} style={{ background: "#1a1a2e", color: "#ffffff" }}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error Message Banner */}
            {submitError && (
              <div id="submit-error-banner" className="p-3 rounded-xl text-xs sm:text-sm font-bold text-center bg-red-500/20 border border-red-500/50 text-red-200 mt-1">
                ⚠️ {submitError}
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-2 sm:mt-3">
              <button
                id="submit-form-btn"
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full text-base sm:text-lg font-black py-4 rounded-2xl shadow-xl"
                style={{ width: "100%" }}>
                {isSubmitting
                  ? "Locking Your Offer..."
                  : svc.isSpecial
                    ? "Confirm & Lock 40% + 10% Student Offer \u2192"
                    : `Confirm & Lock \u20B9${discountAmount} OFF \u2192`}
              </button>
              <p className="text-center text-xs sm:text-sm text-gray-300 font-semibold mt-2">
                &#10003; Instant confirmation &bull; Zero advance payment required
              </p>
            </div>
          </form>

          <div className="text-center pt-3 mt-3 text-xs text-gray-500 border-t border-white/10">
            &copy; Swasthik Salon &amp; Boutique &bull; 100% Privacy Guaranteed
          </div>
        </div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. SUCCESS / CONFIRMATION PAGE (Directly confirmed, Large & Clear)
  // ══════════════════════════════════════════════════════════════════════════════
  if (step === "success" && submittedLead) {
    const isStudentOffer = submittedLead.service.toLowerCase().includes("student");
    const offerLabel = isStudentOffer ? "Flat 40% (ID) + 10% (Review) on All Services" : `₹${submittedLead.discountAmount || 200} OFF Applied`;
    const lockedInMessage = isStudentOffer ? "Your 40% + 10% Student Offer is locked in." : `Your ₹${submittedLead.discountAmount || 200} OFF First Visit Offer is locked in.`;

    return (
      <main style={{ background: "#0f0f1a" }}
        className="h-[100dvh] max-h-[100dvh] overflow-y-auto lg:overflow-hidden flex flex-col items-center justify-center px-4 py-4">
        <div className="w-full max-w-lg">
          
          {/* Instant Confirmation Header */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-3 mb-3">
              <img src="/logo.png" alt="Swasthik Logo"
                className="w-16 h-16 rounded-full object-cover border-2 border-amber-400/50 shadow-md" />
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 0 25px rgba(16,185,129,0.35)" }}>
                <CheckIcon size={28} />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-1">
              Appointment Confirmed!
            </h1>
            <p className="text-sm sm:text-base text-emerald-400 font-bold">
              &#10003; {lockedInMessage}
            </p>
          </div>

          {/* Booking Summary Card */}
          <div className="rounded-2xl p-5 mb-4"
            style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(201,168,76,0.35)" }}>
            <div className="text-center py-2 px-3.5 rounded-xl mb-3.5 text-sm font-black tracking-widest uppercase"
              style={{ background: "rgba(201,168,76,0.18)", color: "#f0d06e", border: "1px solid rgba(201,168,76,0.3)" }}>
              Booking Ref: {submittedLead.id}
            </div>

            <div className="space-y-3 text-sm sm:text-base">
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-gray-400 font-medium">Customer</span>
                <span className="font-bold text-white">{submittedLead.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-gray-400 font-medium">Service</span>
                <span className="font-bold text-white">{submittedLead.service}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-gray-400 font-medium">Date &amp; Time</span>
                <span className="font-bold text-amber-300">
                  {formatDateSafe(submittedLead.preferredDate)} at {submittedLead.preferredTime}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-400 font-medium">Special Offer</span>
                <span className="font-black text-emerald-400">{offerLabel}</span>
              </div>
            </div>
          </div>

          {/* Immediate Next Step Message */}
          <div className="w-full text-center py-3.5 px-4 rounded-2xl mb-4 text-xs sm:text-sm font-medium leading-relaxed"
            style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
            {isStudentOffer ? (
              <span>
                Show your Student ID for <strong>Flat 40% OFF</strong>, plus leave a quick Google review at your visit to unlock the <strong>extra 10% OFF</strong>!
              </span>
            ) : (
              <span>Our team will call you at <strong>{submittedLead.phone}</strong> to welcome you!</span>
            )}
          </div>

          {/* Single Return Button */}
          <button
            id="back-home-btn"
            onClick={goHome}
            className="btn-secondary w-full text-sm sm:text-base font-black py-3.5 rounded-xl"
            style={{ width: "100%", borderColor: "rgba(201,168,76,0.4)", color: "#f0d06e" }}>
            &larr; Back to Home
          </button>

        </div>
      </main>
    );
  }

  return null;
}