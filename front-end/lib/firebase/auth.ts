import { type Auth, connectAuthEmulator, getAuth } from "firebase/auth";

import app from "./config";

let auth: Auth | undefined;

/** The browser's Firebase Auth instance. Returns null if the Firebase keys aren't set. */
export function getFirebaseAuth() {
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return null;
  if (!auth) {
    auth = getAuth(app);
    // Local testing only: points sign-in at the Firebase Auth Emulator instead of the real project.
    const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
    if (emulator) connectAuthEmulator(auth, emulator, { disableWarnings: true });
  }
  return auth;
}

const MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/invalid-credential": "That email or password isn't right.",
  "auth/wrong-password": "That email or password isn't right.",
  "auth/user-not-found": "That email or password isn't right.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/weak-password": "Choose a stronger password.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "We couldn't reach the server. Check your connection and try again.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups and try again.",
  "auth/account-exists-with-different-credential":
    "This email already has an account. Sign in with your email and password.",
  "auth/operation-not-allowed": "This sign-in method isn't turned on yet.",
  "auth/unauthorized-domain": "Sign-in isn't set up for this website yet.",
  "auth/user-disabled": "This account has been turned off. Contact Lumora for help.",
};

/** Visitor-friendly wording. Firebase's own messages include internal error codes. */
export function authErrorMessage(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  return MESSAGES[code] ?? "Something went wrong. Please try again.";
}

/** True when the visitor simply closed the Google window, which isn't an error to report. */
export function isPopupDismissed(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
}
