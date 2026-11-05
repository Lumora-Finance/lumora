import { type NextRequest, NextResponse } from "next/server";

// Auth is handled client-side via Firebase + Supabase profiles.
// This proxy is a lightweight first pass.
// The admin role check is enforced in:
//   1. The AdminLayout client component (redirects non-admins to /dashboard)
//   2. Each /api/admin/* route handler (verifies Firebase token + checks is_admin in DB)
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|brand/|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
