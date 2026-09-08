import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes — no login needed (exact match)
const PUBLIC_ROUTES = ["/", "/login", "/register"];

// Routes that start with these prefixes are always public
const PUBLIC_PREFIXES = [
  "/login",      // login + any query params
  "/register",   // register + any query params
  "/explore/",   // individual dataset explore pages
  "/f/",         // public form submission pages
  "/_next/",     // Next.js internals
  "/api/",       // API routes
  "/auth/",      // Supabase auth callback
  "/favicon",
  "/grid.svg",
  "/icon",
];

function isPublicRoute(pathname: string): boolean {
  // Exact match for public routes
  if (PUBLIC_ROUTES.includes(pathname)) return true;

  // Prefix match (e.g. /explore/some-id, /f/token)
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check for Supabase session cookie
  // Supabase v2 stores the session in cookies that start with "sb-"
  const cookies = [...request.cookies.getAll()];
  const hasCookie = cookies.some(
    (c) => c.name.startsWith("sb-") || c.name.includes("supabase")
  );

  if (!hasCookie) {
    // Redirect unauthenticated users to /login and preserve the intended destination
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except Next.js static assets and API routes
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|api|favicon.ico).*)",
  ],
};
