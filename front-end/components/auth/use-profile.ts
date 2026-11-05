"use client";

import { useEffect, useState } from "react";

import { useAuthUser } from "./use-auth-user";

/**
 * Thin wrapper around useAuthUser that exposes a `profile` shape alongside the
 * Firebase `user` object. Fields mirror what the header, sidebar, admin layout
 * and other UI components expect (display_name, photo_url, email, isAdmin).
 *
 * isAdmin is fetched from /api/me which reads the users table directly.
 * `loading` stays true until BOTH Firebase auth AND the /api/me fetch complete,
 * so the admin layout doesn't redirect before isAdmin is known.
 */
export function useProfile() {
  const { user, loading: authLoading } = useAuthUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [serverProfile, setServerProfile] = useState<{
    is_admin?: boolean;
    area?: string | null;
    address?: string | null;
    location_source?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setServerProfile(null);
      setProfileLoading(false);
      return;
    }

    // Reset to loading when a new user signs in
    setProfileLoading(true);

    let cancelled = false;
    async function loadProfile() {
      try {
        const token = await user!.getIdToken();
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data) {
            setIsAdmin(Boolean(data.is_admin));
            setServerProfile(data);
          }
        } else {
          // 401 or error — user exists in Firebase but not in users table yet
          if (!cancelled) setIsAdmin(false);
        }
      } catch {
        // Silent fail — isAdmin defaults to false
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, [user]);

  const loading = authLoading || (user ? profileLoading : false);

  const profile = user
    ? {
        display_name: user.displayName ?? undefined,
        photo_url: user.photoURL ?? undefined,
        email: user.email ?? undefined,
        area: serverProfile?.area ?? undefined,
        is_admin: serverProfile?.is_admin ?? false,
      }
    : null;

  return { user, profile, isAdmin, loading };
}
