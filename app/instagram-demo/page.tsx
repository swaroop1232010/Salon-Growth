"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Message {
  id: string;
  sender: "customer" | "salon";
  text?: string;
  timestamp: string;
  type?: "text" | "service_menu" | "quick_replies" | "hair_services" | "facial_services" | "beauty_services" | "mens_services" | "bridal_services";
  quickReplies?: string[];
}

export default function InstagramDemo() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-1",
      sender: "customer",
      text: "Hi, what is the price for Hair Spa?",
      timestamp: "10:30 AM",
      type: "text",
    },
    {
      id: "msg-2",
      sender: "salon",
      text: "Hi 👋 Welcome to Swasthik Salon & Boutique!\n\nI'd be happy to help you. What service are you interested in?",
      timestamp: "10:30 AM",
      type: "quick_replies",
      quickReplies: [
        "Hair Services",
        "Facial & Skin",
        "Beauty",
        "Men's Grooming",
        "Bridal",
      ],
    },
  ]);

  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(2); // 1: Msg, 2: Reply, 3: Service, 4: Offer, 5: Claim/Book, 6: Lead Capture
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function getCurrentTime(): string {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function handleSelectQuickReply(reply: string) {
    // 1. Add customer selection message
    const custMsg: Message = {
      id: `cust-${Date.now()}`,
      sender: "customer",
      text: reply,
      timestamp: getCurrentTime(),
      type: "text",
    };

    setMessages((prev) => [...prev, custMsg]);
    setIsTyping(true);
    setActiveStep(3);

    setTimeout(() => {
      setIsTyping(false);
      triggerAutomatedReply(reply.toLowerCase());
    }, 700);
  }

  function triggerAutomatedReply(query: string) {
    const time = getCurrentTime();

    if (query.includes("hair")) {
      setActiveStep(4);
      setMessages((prev) => [
        ...prev,
        {
          id: `salon-${Date.now()}`,
          sender: "salon",
          timestamp: time,
          type: "hair_services",
        },
      ]);
    } else if (query.includes("facial") || query.includes("skin")) {
      setActiveStep(4);
      setMessages((prev) => [
        ...prev,
        {
          id: `salon-${Date.now()}`,
          sender: "salon",
          timestamp: time,
          type: "facial_services",
        },
      ]);
    } else if (query.includes("beauty")) {
      setActiveStep(4);
      setMessages((prev) => [
        ...prev,
        {
          id: `salon-${Date.now()}`,
          sender: "salon",
          timestamp: time,
          type: "beauty_services",
        },
      ]);
    } else if (query.includes("grooming") || query.includes("beard") || query.includes("men")) {
      setActiveStep(4);
      setMessages((prev) => [
        ...prev,
        {
          id: `salon-${Date.now()}`,
          sender: "salon",
          timestamp: time,
          type: "mens_services",
        },
      ]);
    } else if (query.includes("bridal")) {
      setActiveStep(4);
      setMessages((prev) => [
        ...prev,
        {
          id: `salon-${Date.now()}`,
          sender: "salon",
          timestamp: time,
          type: "bridal_services",
        },
      ]);
    } else if (query.includes("price") || query.includes("cost") || query.includes("rate")) {
      setActiveStep(2);
      setMessages((prev) => [
        ...prev,
        {
          id: `salon-${Date.now()}`,
          sender: "salon",
          text: "Sure! Please choose the service you'd like to know the price for:",
          timestamp: time,
          type: "quick_replies",
          quickReplies: [
            "Hair Services",
            "Facial & Skin",
            "Beauty",
            "Men's Grooming",
            "Bridal",
          ],
        },
      ]);
    } else {
      setActiveStep(2);
      setMessages((prev) => [
        ...prev,
        {
          id: `salon-${Date.now()}`,
          sender: "salon",
          text: "Thanks for reaching out! We offer specialized salon services with an exclusive ₹200 OFF first-visit offer. Which service would you like to explore?",
          timestamp: time,
          type: "quick_replies",
          quickReplies: [
            "Hair Services",
            "Facial & Skin",
            "Beauty",
            "Men's Grooming",
            "Bridal",
          ],
        },
      ]);
    }
  }

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userText = inputVal.trim();
    setInputVal("");

    // Add user message
    const custMsg: Message = {
      id: `cust-${Date.now()}`,
      sender: "customer",
      text: userText,
      timestamp: getCurrentTime(),
      type: "text",
    };

    setMessages((prev) => [...prev, custMsg]);
    setIsTyping(true);
    setActiveStep(1);

    setTimeout(() => {
      setIsTyping(false);
      triggerAutomatedReply(userText.toLowerCase());
    }, 700);
  }

  function resetChat() {
    setMessages([
      {
        id: "msg-1",
        sender: "customer",
        text: "Hi, what is the price for Hair Spa?",
        timestamp: "10:30 AM",
        type: "text",
      },
      {
        id: "msg-2",
        sender: "salon",
        text: "Hi 👋 Welcome to Swasthik Salon & Boutique!\n\nI'd be happy to help you. What service are you interested in?",
        timestamp: "10:30 AM",
        type: "quick_replies",
        quickReplies: [
          "Hair Services",
          "Facial & Skin",
          "Beauty",
          "Men's Grooming",
          "Bridal",
        ],
      },
    ]);
    setActiveStep(2);
  }

  const automationSteps = [
    { num: 1, title: "Customer Message", desc: "User inquires via Instagram DM" },
    { num: 2, title: "Automated Reply", desc: "Instant salon greeting & service guide" },
    { num: 3, title: "Service Selection", desc: "Customer picks their category" },
    { num: 4, title: "Offer Presentation", desc: "Transparent price + ₹200 OFF savings" },
    { num: 5, title: "Claim / Book", desc: "Seamless bridge to booking page" },
    { num: 6, title: "Lead Capture", desc: "Lead logged with Instagram DM attribution" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#0b0c16" }}>
      {/* Top Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b"
        style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black"
            style={{ background: "linear-gradient(135deg, #f09433, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold text-base">Instagram DM Automation</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: "rgba(236,72,153,0.2)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.3)" }}>
                V2 Prototype
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Simulate how a customer enquiry from Instagram can be automatically guided from question &rarr; service &rarr; offer &rarr; booking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={resetChat}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "rgba(255,255,255,0.06)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}>
            &#8634; Reset Chat
          </button>
          <Link href="/dashboard"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "rgba(201,168,76,0.15)", color: "#f0d06e", border: "1px solid rgba(201,168,76,0.3)" }}>
            Dashboard &rarr;
          </Link>
          <Link href="/"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "rgba(255,255,255,0.06)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.15)" }}>
            Landing Page &rarr;
          </Link>
        </div>
      </header>

      {/* Main Content: Split Screen */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT SIDE: Instagram DM Chat Frame (7 cols) */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-md rounded-[32px] overflow-hidden flex flex-col shadow-2xl border"
              style={{
                background: "#000000",
                borderColor: "rgba(255,255,255,0.15)",
                height: "640px",
                boxShadow: "0 25px 60px -15px rgba(0,0,0,0.7), 0 0 40px rgba(236,72,153,0.15)",
              }}>

              {/* Instagram App Header */}
              <div className="px-4 py-3.5 flex items-center justify-between border-b"
                style={{ background: "#121212", borderColor: "#262626" }}>
                <div className="flex items-center gap-3">
                  <div className="text-gray-400 text-lg cursor-pointer">&#8592;</div>
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-gray-900 overflow-hidden"
                      style={{ background: "linear-gradient(135deg, #c9a84c, #f0d06e)" }}>
                      ✂️
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-black" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white text-sm font-bold">swasthik_salon</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6" className="inline-block">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <div className="text-[11px] text-gray-400">Swasthik Salon &amp; Boutique &bull; Active now</div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 text-gray-400">
                  <span className="text-lg cursor-pointer">&#128222;</span>
                  <span className="text-lg cursor-pointer">&#128249;</span>
                  <span className="text-base cursor-pointer">&#9432;</span>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5" style={{ background: "#000000" }}>
                
                {/* Conversation intro badge */}
                <div className="text-center py-2">
                  <div className="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center text-xl"
                    style={{ background: "linear-gradient(135deg, #c9a84c, #f0d06e)" }}>
                    ✂️
                  </div>
                  <div className="text-white text-xs font-bold">Swasthik Salon &amp; Boutique</div>
                  <div className="text-[11px] text-gray-500">Instagram &bull; 2.4k followers</div>
                  <div className="text-[10px] text-gray-600 mt-1">Automated DM Assistant Active</div>
                </div>

                {messages.map((msg) => {
                  const isCust = msg.sender === "customer";
                  return (
                    <div key={msg.id} className={`flex flex-col ${isCust ? "items-end" : "items-start"}`}>
                      
                      {/* Simple Text Bubble */}
                      {msg.text && (
                        <div
                          className="max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line break-words"
                          style={
                            isCust
                              ? {
                                  background: "linear-gradient(135deg, #3797f0, #6156f0)",
                                  color: "#ffffff",
                                  borderBottomRightRadius: "4px",
                                }
                              : {
                                  background: "#262626",
                                  color: "#f5f5f5",
                                  borderBottomLeftRadius: "4px",
                                }
                          }>
                          {msg.text}
                        </div>
                      )}

                      {/* Quick Replies Options */}
                      {msg.type === "quick_replies" && msg.quickReplies && (
                        <div className="mt-2.5 w-full">
                          <p className="text-[11px] font-semibold text-gray-400 mb-1.5">Quick Options:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.quickReplies.map((qr) => (
                              <button
                                key={qr}
                                id={`qr-${qr.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                                onClick={() => handleSelectQuickReply(qr)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all hover:scale-105"
                                style={{
                                  background: "rgba(255,255,255,0.08)",
                                  borderColor: "rgba(255,255,255,0.2)",
                                  color: "#ffffff",
                                  cursor: "pointer",
                                }}>
                                {qr} &rarr;
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hair Services Structured Card */}
                      {msg.type === "hair_services" && (
                        <div className="mt-2 w-full max-w-[92%] rounded-2xl p-4 border"
                          style={{ background: "#1c1c1e", borderColor: "#2c2c2e" }}>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-2">
                            <span>✂️</span> HERE ARE OUR HAIR SERVICES
                          </div>

                          <div className="space-y-2 mb-3 text-xs">
                            <div className="p-2 rounded-xl bg-white/5 flex items-center justify-between">
                              <div>
                                <div className="font-bold text-white">Haircut</div>
                                <div className="text-[11px] text-gray-400">Regular: &#8377;499</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-emerald-400">First Visit: &#8377;299</div>
                                <div className="text-[10px] text-amber-300 font-semibold">Save &#8377;200</div>
                              </div>
                            </div>

                            <div className="p-2 rounded-xl bg-white/5 flex items-center justify-between border border-amber-500/30">
                              <div>
                                <div className="font-bold text-white">Hair Spa</div>
                                <div className="text-[11px] text-gray-400">Regular: &#8377;999</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-emerald-400">First Visit: &#8377;799</div>
                                <div className="text-[10px] text-amber-300 font-semibold">Save &#8377;200</div>
                              </div>
                            </div>

                            <div className="p-2 rounded-xl bg-white/5 flex items-center justify-between">
                              <div>
                                <div className="font-bold text-white">Hair Color</div>
                                <div className="text-[11px] text-gray-400">Regular: &#8377;1,499</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-emerald-400">First Visit: &#8377;1,299</div>
                                <div className="text-[10px] text-amber-300 font-semibold">Save &#8377;200</div>
                              </div>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl mb-3 text-[11px] text-amber-200"
                            style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}>
                            🎁 <strong>First-time customers can save &#8377;200</strong> on their first visit.
                          </div>

                          <div className="flex gap-2">
                            <Link
                              href="/?utm_source=instagram&utm_medium=dm&utm_campaign=instagram_dm&service=Hair+Spa&claim=true"
                              id="claim-offer-btn-hair"
                              className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold text-gray-900 transition-all hover:brightness-110"
                              style={{ background: "linear-gradient(135deg, #c9a84c, #f0d06e)" }}>
                              Claim First Visit Offer
                            </Link>
                            <Link
                              href="/?utm_source=instagram&utm_medium=dm&utm_campaign=instagram_dm&service=Hair+Spa&claim=true"
                              id="book-appointment-btn-hair"
                              className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:bg-white/10"
                              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
                              Book Appointment
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Facial & Skin Structured Card */}
                      {msg.type === "facial_services" && (
                        <div className="mt-2 w-full max-w-[92%] rounded-2xl p-4 border"
                          style={{ background: "#1c1c1e", borderColor: "#2c2c2e" }}>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400 mb-2">
                            <span>✨</span> FACIAL &amp; SKIN CARE
                          </div>

                          <div className="p-2.5 rounded-xl bg-white/5 flex items-center justify-between mb-3 text-xs">
                            <div>
                              <div className="font-bold text-white">Facial</div>
                              <div className="text-[11px] text-gray-400">Regular: &#8377;799</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-400">First Visit: &#8377;599</div>
                              <div className="text-[10px] text-amber-300 font-semibold">Save &#8377;200</div>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl mb-3 text-[11px] text-amber-200"
                            style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}>
                            🎁 <strong>First-time customers can save &#8377;200</strong> on their first visit.
                          </div>

                          <div className="flex gap-2">
                            <Link
                              href="/?utm_source=instagram&utm_medium=dm&utm_campaign=instagram_dm&service=Facial&claim=true"
                              id="claim-offer-btn-facial"
                              className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold text-gray-900 transition-all hover:brightness-110"
                              style={{ background: "linear-gradient(135deg, #c9a84c, #f0d06e)" }}>
                              Claim First Visit Offer
                            </Link>
                            <Link
                              href="/?utm_source=instagram&utm_medium=dm&utm_campaign=instagram_dm&service=Facial&claim=true"
                              id="book-appointment-btn-facial"
                              className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:bg-white/10"
                              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
                              Book Appointment
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Beauty Services Structured Card */}
                      {msg.type === "beauty_services" && (
                        <div className="mt-2 w-full max-w-[92%] rounded-2xl p-4 border"
                          style={{ background: "#1c1c1e", borderColor: "#2c2c2e" }}>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 mb-2">
                            <span>💅</span> BEAUTY &amp; WELLNESS
                          </div>

                          <div className="p-2.5 rounded-xl bg-white/5 flex items-center justify-between mb-3 text-xs">
                            <div>
                              <div className="font-bold text-white">Manicure &amp; Pedicure</div>
                              <div className="text-[11px] text-gray-400">Regular: &#8377;699</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-400">First Visit: &#8377;499</div>
                              <div className="text-[10px] text-amber-300 font-semibold">Save &#8377;200</div>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl mb-3 text-[11px] text-amber-200"
                            style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}>
                            🎁 <strong>First-time customers can save &#8377;200</strong> on their first visit.
                          </div>

                          <div className="flex gap-2">
                            <Link
                              href="/?utm_source=instagram&utm_medium=dm&utm_campaign=instagram_dm&service=Facial&claim=true"
                              id="claim-offer-btn-beauty"
                              className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold text-gray-900 transition-all"
                              style={{ background: "linear-gradient(135deg, #c9a84c, #f0d06e)" }}>
                              Claim First Visit Offer
                            </Link>
                            <Link
                              href="/?utm_source=instagram&utm_medium=dm&utm_campaign=instagram_dm&service=Facial&claim=true"
                              id="book-appointment-btn-beauty"
                              className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold text-white"
                              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
                              Book Appointment
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Men's Grooming Structured Card */}
                      {msg.type === "mens_services" && (
                        <div className="mt-2 w-full max-w-[92%] rounded-2xl p-4 border"
                          style={{ background: "#1c1c1e", borderColor: "#2c2c2e" }}>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 mb-2">
                            <span>🧔</span> MEN&apos;S GROOMING
                          </div>

                          <div className="p-2.5 rounded-xl bg-white/5 flex items-center justify-between mb-3 text-xs">
                            <div>
                              <div className="font-bold text-white">Beard Grooming</div>
                              <div className="text-[11px] text-gray-400">Regular: &#8377;299</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-400">First Visit: &#8377;99</div>
                              <div className="text-[10px] text-amber-300 font-semibold">Save &#8377;200</div>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl mb-3 text-[11px] text-amber-200"
                            style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}>
                            🎁 <strong>First-time customers can save &#8377;200</strong> on their first visit.
                          </div>

                          <div className="flex gap-2">
                            <Link
                              href="/?utm_source=instagram&utm_medium=dm&utm_campaign=instagram_dm&service=Beard+Grooming&claim=true"
                              id="claim-offer-btn-mens"
                              className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold text-gray-900 transition-all"
                              style={{ background: "linear-gradient(135deg, #c9a84c, #f0d06e)" }}>
                              Claim First Visit Offer
                            </Link>
                            <Link
                              href="/?utm_source=instagram&utm_medium=dm&utm_campaign=instagram_dm&service=Beard+Grooming&claim=true"
                              id="book-appointment-btn-mens"
                              className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold text-white"
                              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
                              Book Appointment
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Bridal Structured Card */}
                      {msg.type === "bridal_services" && (
                        <div className="mt-2 w-full max-w-[92%] rounded-2xl p-4 border"
                          style={{ background: "#1c1c1e", borderColor: "#2c2c2e" }}>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 mb-2">
                            <span>👰</span> BRIDAL MAKEOVER &amp; STYLING
                          </div>

                          <p className="text-xs text-gray-300 mb-3 leading-relaxed">
                            Bridal services are customized based on your requirements.
                          </p>

                          <Link
                            href="/?utm_source=instagram&utm_medium=dm&utm_campaign=instagram_dm&service=Facial&claim=true"
                            id="request-bridal-btn"
                            className="block text-center py-2.5 rounded-xl text-xs font-bold text-gray-900 transition-all hover:brightness-110"
                            style={{ background: "linear-gradient(135deg, #c9a84c, #f0d06e)" }}>
                            Request Bridal Consultation
                          </Link>
                        </div>
                      )}

                      <span className="text-[10px] text-gray-600 mt-1 px-1">{msg.timestamp}</span>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/10 w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage}
                className="p-3 border-t flex items-center gap-2"
                style={{ background: "#121212", borderColor: "#262626" }}>
                <input
                  id="dm-message-input"
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Type a customer message..."
                  className="flex-1 px-4 py-2.5 rounded-full text-xs text-white placeholder-gray-500 outline-none"
                  style={{ background: "#262626", border: "1px solid #363636" }}
                />
                <button
                  id="dm-send-btn"
                  type="submit"
                  className="px-4 py-2 rounded-full text-xs font-bold text-white transition-all hover:scale-105"
                  style={{
                    background: inputVal.trim()
                      ? "linear-gradient(135deg, #3797f0, #6156f0)"
                      : "rgba(255,255,255,0.1)",
                    cursor: inputVal.trim() ? "pointer" : "default",
                  }}>
                  Send
                </button>
              </form>

            </div>
          </div>

          {/* RIGHT SIDE: Automation Flow Visualization (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Flow Visualizer Card */}
            <div className="rounded-3xl p-6 border bg-white/[0.03]"
              style={{ borderColor: "rgba(255,255,255,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
              
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white font-bold text-base">Automation Flow</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Real-time customer journey state</p>
                </div>
                <div className="text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>
                  Step {activeStep} of 6
                </div>
              </div>

              <div className="space-y-3">
                {automationSteps.map((step) => {
                  const isCurrent = step.num === activeStep;
                  const isPassed = step.num < activeStep;

                  return (
                    <div key={step.num}
                      className="p-3 rounded-2xl border transition-all flex items-center gap-3.5"
                      style={
                        isCurrent
                          ? {
                              background: "rgba(201,168,76,0.12)",
                              borderColor: "rgba(201,168,76,0.4)",
                              boxShadow: "0 0 15px rgba(201,168,76,0.15)",
                            }
                          : isPassed
                          ? {
                              background: "rgba(16,185,129,0.06)",
                              borderColor: "rgba(16,185,129,0.25)",
                            }
                          : {
                              background: "rgba(255,255,255,0.02)",
                              borderColor: "rgba(255,255,255,0.05)",
                              opacity: 0.6,
                            }
                      }>
                      
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                        style={
                          isCurrent
                            ? { background: "linear-gradient(135deg, #c9a84c, #f0d06e)", color: "#1a1a2e" }
                            : isPassed
                            ? { background: "#10b981", color: "#ffffff" }
                            : { background: "rgba(255,255,255,0.1)", color: "#9ca3af" }
                        }>
                        {isPassed ? "✓" : step.num}
                      </div>

                      <div className="flex-1">
                        <div className="text-xs font-bold flex items-center justify-between"
                          style={{ color: isCurrent ? "#f0d06e" : isPassed ? "#34d399" : "#ffffff" }}>
                          <span>{step.title}</span>
                          {isCurrent && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                              style={{ background: "#c9a84c", color: "#1a1a2e" }}>
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{step.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Attribution Callout */}
              <div className="mt-5 p-3.5 rounded-2xl border text-xs leading-relaxed"
                style={{ background: "rgba(236,72,153,0.08)", borderColor: "rgba(236,72,153,0.25)", color: "#f9a8d4" }}>
                <div className="font-bold mb-1 flex items-center gap-1.5 text-pink-300">
                  <span>📊</span> Lead Attribution Rule
                </div>
                Leads originating from this Instagram DM simulation are tagged with:
                <div className="mt-2 font-mono text-[11px] p-2 rounded-xl bg-black/40 text-gray-300 space-y-0.5">
                  <div>source = &quot;Instagram&quot;</div>
                  <div>medium = &quot;DM&quot;</div>
                  <div>campaign = &quot;Instagram DM&quot;</div>
                </div>
              </div>

            </div>

            {/* Quick Test Prompt Ideas */}
            <div className="rounded-3xl p-5 border bg-white/[0.02]"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
                Try Typing These Keywords:
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {["hair", "hair spa", "facial", "bridal", "price"].map((kw) => (
                  <button
                    key={kw}
                    onClick={() => {
                      setInputVal(kw);
                      setTimeout(() => {
                        const btn = document.getElementById("dm-send-btn");
                        btn?.click();
                      }, 100);
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg border text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", cursor: "pointer" }}>
                    &ldquo;{kw}&rdquo;
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
