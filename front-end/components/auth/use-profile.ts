"use client";

import { useAuthUser } from "./use-auth-user";

/**
 * Thin wrapper around useAuthUser that exposes a `profile` shape alongside the
 * Firebase `user` object. Fields mirror what the header, sidebar, admin layout
 * and other UI components expect (display_name, photo_url, email, isAdmin).
 */
export function useProfile() {
  const { user, loading } = useAuthUser();

  const profile = user
    ? {
        display_name: user.displayName ?? undefined,
        photo_url: user.photoURL ?? undefined,
        email: user.email ?? undefined,
        isAdmin: false, // populated below via custom claims when available
      }
    : null;

  // isAdmin is also returned at the top level because some components
  // (admin layout, sidebar) destructure it directly from useProfile().
  const isAdmin = false; // will be true once Firebase custom claims are set

  return { user, profile, isAdmin, loading };
}
