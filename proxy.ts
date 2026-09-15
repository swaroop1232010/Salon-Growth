import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Proxy — Route Protection (optimistic check only)
 *
 * NOTE: @supabase/supabase-js v2 stores sessions in localStorage, NOT cookies.
 * To bridge this gap, we set a lightweight custom cookie "sgs-staff-auth=1"
 * after a successful login and clear it on logout. The proxy reads this cookie
 * to decide whether to redirect.
 *
 * This is a UX-level guard only. The real security gate is Supabase RLS —
 * an authenticated Supabase session is required to SELECT/UPDATE leads.
 * A forged cookie would pass the proxy but be rejected by the database.
 */

const PROTECTED_ROUTES = ["/dashboard"];
const AUTH_ROUTES = ["/login"];

// Cookie name set after login, cleared on logout
const AUTH_COOKIE = "sgs-staff-auth";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Check for our custom auth cookie (set client-side after login)
  const hasSession = req.cookies.get(AUTH_COOKIE)?.value === "1";

  // Unauthenticated → /dashboard: redirect to /login
  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated → /login: redirect to /dashboard
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

// Run proxy on all routes except static assets
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
};
