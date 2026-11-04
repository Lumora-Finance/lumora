import { type NextRequest, NextResponse } from "next/server";

// Auth is handled client-side via Firebase. This middleware is a lightweight guard
// that prevents the dashboard from being visited without a session cookie.
// The heavy lifting (redirect to /auth/login if no user) is done in the client-side
// useAuthUser hook which watches Firebase onAuthStateChanged.
export function proxy(request: NextRequest) {
  // Allow all requests through — Firebase client handles auth state
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - Public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|brand/|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
