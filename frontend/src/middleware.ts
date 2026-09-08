import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes — no login needed
const PUBLIC_ROUTES = ["/", "/login", "/register", "/f"];

// Routes that start with these prefixes are always public
const PUBLIC_PREFIXES = [
  "/explore/",   // individual dataset explore pages
  "/f/",         // public form submission pages
  "/_next/",     // Next.js internals
  "/favicon",
  "/grid.svg",
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
  // Supabase stores the session in a cookie that starts with "sb-"
  const hasCookie = [...request.cookies.getAll()].some((c) =>
    c.name.startsWith("sb-")
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
    "/((?!_next/static|_next/image|api|favicon.ico).*)",
  ],
};
