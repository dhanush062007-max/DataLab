import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This middleware exists for routing purposes only.
// Auth is handled at the page level via supabase.auth.getSession()
// since @supabase/supabase-js stores sessions in localStorage, not HTTP cookies.

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api|favicon.ico).*)",
  ],
};
