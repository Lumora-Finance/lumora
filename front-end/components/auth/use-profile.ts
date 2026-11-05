"use client";

import { useEffect, useState } from "react";

import { useAuthUser } from "./use-auth-user";

/**
 * Thin wrapper around useAuthUser that exposes a `profile` shape alongside the
 * Firebase `user` object. Fields mirror what the header, sidebar, admin layout
 * and other UI components expect (display_name, photo_url, email, isAdmin).
 *
 * isAdmin is fetched from /api/me which reads the users table directly.
 */
export function useProfile() {
  const { user, loading } = useAuthUser();
  const [isAdmin, setIsAdmin] = useState(false);
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
      return;
    }

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
        }
      } catch {
        // Silent fail — isAdmin defaults to false
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, [user]);

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
