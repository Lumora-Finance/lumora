"use client";

import { useEffect, useRef, useState } from "react";
import { getAuth } from "firebase/auth";

import app from "@/lib/firebase/config";
import { trackTask } from "@/lib/loading/progress";

/**
 * Maps the short dashboard keys used by board components to their API paths.
 * Add new keys here as new dashboard sections are built.
 */
const ENDPOINTS: Record<string, string> = {
  board: "/api/board",
  bookings: "/api/bookings",
  stats: "/api/dashboard/stats",
  posts: "/api/dashboard/posts",
  transactions: "/api/dashboard/transactions",
  me: "/api/me",
};

type DashboardState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch?: () => void;
};

/**
 * Fetch dashboard data for a named key. Attaches the signed-in user's Firebase
 * ID token so the route handler can identify the caller.
 *
 * Usage:
 *   const { data, loading } = useDashboardData<Slot[]>("board");
 */
export function useDashboardData<T>(key: string): DashboardState<T> & { refetch: () => void } {
  const [state, setState] = useState<DashboardState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);

  // Prevent state updates after the component unmounts.
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const endpoint = ENDPOINTS[key];

    if (!endpoint) {
      setState({ data: null, loading: false, error: `Unknown dashboard key: "${key}"` });
      return;
    }

    let cancelled = false;
    // Counts towards what the loaders show, so their progress comes from real requests.
    const finished = trackTask(key);

    async function fetchData() {
      try {
        // Get a fresh ID token. getIdToken(false) returns the cached token if
        // it hasn't expired; pass true to force a refresh if needed.
        const auth = getAuth(app);
        // On a fresh load the saved session isn't back yet, and asking now would look signed out.
        await auth.authStateReady();
        const token = auth.currentUser
          ? await auth.currentUser.getIdToken(false)
          : null;

        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(endpoint, { headers });

        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }

        const json: T = await res.json();

        if (!cancelled && !cancelledRef.current) {
          setState({ data: json, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled && !cancelledRef.current) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load data",
          });
        }
      } finally {
        finished();
      }
    }

    fetchData();

    return () => {
      cancelled = true;
      cancelledRef.current = true;
    };
  }, [key, tick]);

  return { ...state, refetch: () => setTick((t) => t + 1) };
}
