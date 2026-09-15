"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

/** Sets a lightweight cookie so the proxy can detect the auth session. */
function setAuthCookie() {
  document.cookie = "sgs-staff-auth=1; path=/; max-age=604800; SameSite=Lax";
}

// ─── Inner form — uses useSearchParams (must be inside Suspense) ──────────────
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  // Redirect already-logged-in users immediately
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Ensure the proxy cookie is present before navigating
        setAuthCookie();
        const next = searchParams.get("next") || "/dashboard";
        router.replace(next);
      } else {
        setCheckingSession(false);
      }
    });
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError("");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        // Map common Supabase auth errors to human-friendly messages
        if (
          signInError.message.toLowerCase().includes("invalid login credentials") ||
          signInError.message.toLowerCase().includes("invalid email or password")
        ) {
          setError("Incorrect email or password. Please try again.");
        } else if (signInError.message.toLowerCase().includes("email not confirmed")) {
          setError("Please confirm your email address before logging in.");
        } else if (signInError.message.toLowerCase().includes("too many requests")) {
          setError("Too many login attempts. Please wait a few minutes and try again.");
        } else {
          setError(signInError.message);
        }
        return;
      }

      // Success — set proxy cookie then navigate
      setAuthCookie();
      const next = searchParams.get("next") || "/dashboard";
      router.push(next);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Show spinner while checking session to avoid flash of login form
  if (checkingSession) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#c9a84c", borderTopColor: "transparent" }}
        />
        <p className="text-sm" style={{ color: "#6b7280" }}>
          Checking session…
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-8"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
      }}
    >
      <form onSubmit={handleSubmit} noValidate>
        {/* Email */}
        <div className="mb-5">
          <label
            htmlFor="login-email"
            className="block text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: "#9ca3af" }}
          >
            Email Address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            placeholder="staff@swasthiksalon.com"
            required
            className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white",
              caretColor: "#c9a84c",
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = "1px solid rgba(201,168,76,0.6)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,168,76,0.08)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "1px solid rgba(255,255,255,0.12)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label
            htmlFor="login-password"
            className="block text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: "#9ca3af" }}
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="••••••••"
            required
            className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white",
              caretColor: "#c9a84c",
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = "1px solid rgba(201,168,76,0.6)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,168,76,0.08)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "1px solid rgba(255,255,255,0.12)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div
            id="login-error-msg"
            className="mb-5 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5",
            }}
          >
            <span className="text-base flex-shrink-0">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          id="login-submit-btn"
          type="submit"
          disabled={loading || !email.trim() || !password}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all"
          style={{
            background:
              loading || !email.trim() || !password
                ? "rgba(201,168,76,0.3)"
                : "linear-gradient(135deg, #c9a84c, #f0d06e)",
            border: "none",
            cursor: loading || !email.trim() || !password ? "not-allowed" : "pointer",
            color:
              loading || !email.trim() || !password
                ? "rgba(255,255,255,0.4)"
                : "#1a1a2e",
            boxShadow:
              loading || !email.trim() || !password
                ? "none"
                : "0 4px 20px rgba(201,168,76,0.3)",
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin inline-block"
                style={{
                  borderColor: "rgba(26,26,46,0.5)",
                  borderTopColor: "transparent",
                }}
              />
              Signing in…
            </span>
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Page shell — wraps LoginForm in Suspense for useSearchParams ─────────────
export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#0d0d1a" }}
    >
      {/* Background accent */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Swasthik Salon Logo"
            className="w-16 h-16 rounded-2xl object-cover mb-4"
            style={{
              border: "2px solid rgba(201,168,76,0.4)",
              boxShadow: "0 8px 32px rgba(201,168,76,0.15)",
            }}
          />
          <p
            className="text-xs font-bold tracking-widest mb-1"
            style={{ color: "#c9a84c" }}
          >
            SWASTHIK SALON &amp; BOUTIQUE
          </p>
          <h1 className="text-2xl font-black text-white text-center">
            Staff Login
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
            Sign in to access the dashboard
          </p>
        </div>

        {/* Suspense boundary required for useSearchParams() in a page component */}
        <Suspense
          fallback={
            <div className="flex flex-col items-center gap-3 py-12">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "#c9a84c", borderTopColor: "transparent" }}
              />
              <p className="text-sm" style={{ color: "#6b7280" }}>
                Loading…
              </p>
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        {/* Footer note */}
        <p className="text-center text-xs mt-6" style={{ color: "#4b5563" }}>
          Staff accounts are managed by the salon administrator.
          <br />
          Contact your admin if you need access.
        </p>
      </div>
    </div>
  );
}
