import { useSyncExternalStore } from "react";

/** What a key moment says once it's ready. */
export type MomentFinal = {
  /** The small line, in sage. */
  top: string;
  /** The main line, in paper. */
  line: string;
  /** How full the ring ends up, from 0 to 1. */
  fraction: number;
  /** What's in the ring. A number counts up. Text just appears. Nothing shows an empty ring. */
  number?: number;
  text?: string;
};

export type Moment = {
  id: number;
  /** What the bar says, if there's still work to wait for. */
  label: string;
  /** The work. Resolved straight away when it's already done, which skips the bar. */
  work: Promise<MomentFinal>;
  /** Runs under full cover, so the page can change without being seen. */
  whenCovered?: () => void;
};

let current: Moment | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** A full-screen key moment. Only for things worth stopping for: a booking, a payout, finishing onboarding. */
export function playMoment(moment: Omit<Moment, "id">) {
  current = { ...moment, id: nextId++ };
  notify();
}

export function endMoment() {
  current = null;
  notify();
}

export function useCurrentMoment() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}

const SEEN_KEY = "lumora.loader.seen";

/** Whether this tab has already had the full first-load sequence. Forgotten on sign-out. */
export function loaderSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
export function markLoaderSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {}
  document.documentElement.dataset.lumoraSeen = "1";
}
export function forgetLoaderSeen() {
  try {
    sessionStorage.removeItem(SEEN_KEY);
  } catch {}
  delete document.documentElement.dataset.lumoraSeen;
}
