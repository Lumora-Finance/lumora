"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useSyncExternalStore } from "react";

import { getFirebaseAuth } from "@/lib/firebase/auth";

type AuthState = { user: User | null; loading: boolean };

// Without keys there's no session to wait for.
const INITIAL: AuthState = {
  user: null,
  loading: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
};

// One store for the whole app. Next keeps visited pages mounted but hidden, and a page coming
// back into view must see the current user at once, not what it last knew.
let state = INITIAL;
let listening = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!listening) {
    const auth = getFirebaseAuth();
    if (auth) {
      listening = true;
      onAuthStateChanged(auth, (user) => {
        state = { user, loading: false };
        listeners.forEach((notify) => notify());
      });
    }
  }
  return () => {
    listeners.delete(listener);
  };
}

/** The signed-in user. `loading` stays true until Firebase has restored any saved session. */
export function useAuthUser() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}
