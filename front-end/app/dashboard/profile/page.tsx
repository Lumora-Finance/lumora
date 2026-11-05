"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Camera, CheckCircle2, ShieldAlert, LogOut, Trash2 } from "lucide-react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

import { LogoVideo } from "@/components/dashboard/logo-video";
import { ProfileLocation } from "@/components/location/profile-location";
import { ProfileReliability } from "@/components/location/profile-reliability";
import { Reveal } from "@/components/motion/reveal";
import { TransactionPinModal } from "@/components/dashboard/transaction-pin-modal";
import { fx, playOnEnter, useGSAP } from "@/lib/gsap/effects";
import { useAuthUser } from "@/components/auth/use-auth-user";
import { getFirebaseAuth } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";


export default function ProfilePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user } = useAuthUser();

  const photoURL = user?.photoURL ?? null;
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "User";
  const email = user?.email ?? "";
  const isGoogleUser = user?.providerData?.some((p) => p.providerId === "google.com") ?? false;
  const initials = displayName.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  const [name, setName] = useState(displayName);
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  useGSAP(
    () => {
      const root = heroRef.current;
      if (!root) return;
      playOnEnter(fx("riseIn", root.querySelectorAll("[data-rise]"), { stagger: 0.1 }), root, "top 85%");
    },
    { scope: heroRef },
  );

  async function handleSignOut() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    router.replace("/auth/login");
  }

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

      {/* Hero */}
      <div
        ref={heroRef}
        data-rhythm="field"
        className="relative isolate mb-8 overflow-hidden rounded-2xl bg-field px-6 py-10 text-paper lg:px-10 lg:py-12"
      >
        <LogoVideo />

        <div data-rise className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative">
            <div className="size-20 overflow-hidden rounded-full ring-4 ring-sage/30 lg:size-24">
              {photoURL ? (
                <Image src={photoURL} alt={displayName} fill className="object-cover" referrerPolicy="no-referrer" sizes="96px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-field-soft font-num text-display-lg-sm font-medium text-sage">
                  {initials}
                </div>
              )}
            </div>
            <button
              aria-label="Change photo"
              className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-paper text-ink shadow-md hover:bg-sage-soft"
            >
              <Camera strokeWidth={1.5} className="size-3.5" />
            </button>
          </div>

          <div>
            <h1 className="font-display text-[1.6rem] font-medium leading-tight text-paper">
              {displayName}
            </h1>
            <p className="text-body-sm text-paper/60">{email}</p>
            {isGoogleUser && (
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-field-soft/60 px-2.5 py-1 text-label text-sage/80">
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
                  <path fill="#4285F4" d="M15.1 8.17c0-.52-.05-1.02-.13-1.5H8v2.84h3.95a3.37 3.37 0 0 1-1.47 2.21v1.84h2.38c1.39-1.28 2.19-3.16 2.19-5.39z" />
                  <path fill="#34A853" d="M8 15.33c1.98 0 3.64-.66 4.86-1.77l-2.38-1.84c-.66.44-1.49.7-2.48.7-1.9 0-3.52-1.29-4.1-3.02H1.43v1.9A7.33 7.33 0 0 0 8 15.33z" />
                  <path fill="#FBBC05" d="M3.9 9.4a4.4 4.4 0 0 1 0-2.8V4.7H1.43a7.33 7.33 0 0 0 0 6.59L3.9 9.4z" />
                  <path fill="#EA4335" d="M8 3.58c1.07 0 2.04.37 2.8 1.1l2.1-2.1A7.33 7.33 0 0 0 1.43 4.7L3.9 6.6C4.48 4.87 6.1 3.58 8 3.58z" />
                </svg>
                Connected with Google
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Verification status */}
      <Reveal effect="riseIn">
        <div className="mb-6 overflow-hidden rounded-xl border border-amber/30 bg-amber-soft/40">
          <div className="flex items-start gap-4 p-5">
            <ShieldAlert strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-amber" />
            <div className="flex-1">
              <p className="font-medium text-ink">Verification required to list produce</p>
              <p className="mt-1 text-body-sm text-ink-muted">
                Submit a government ID and a short selfie. Takes less than 2 minutes. Reviewed within 24 hours.
              </p>
            </div>
            <button className="shrink-0 rounded-lg bg-amber px-4 py-2 text-body-sm font-medium text-ink hover:bg-amber/90">
              Start verification
            </button>
          </div>
          <div className="flex items-center gap-3 border-t border-amber/20 bg-amber-soft/30 px-5 py-3">
            {["Upload ID", "Take selfie", "Under review", "Verified"].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-4 bg-amber/30" />}
                <div className={cn("flex items-center gap-1.5 text-label", i === 0 ? "font-medium text-amber" : "text-ink-muted")}>
                  <span className={cn("flex size-4 items-center justify-center rounded-full text-[10px] font-medium", i === 0 ? "bg-amber text-ink" : "bg-line text-ink-muted")}>
                    {i + 1}
                  </span>
                  <span className="hidden sm:inline">{step}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Edit form */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">

        {/* Left: edit profile */}
        <Reveal effect="riseIn">
          <form onSubmit={saveProfile} className="rounded-xl border border-line bg-white p-6 shadow-sm">
            <h2 className="text-heading font-medium text-ink">Edit Profile</h2>

            <div className="mt-5 space-y-4">
              {[
                { label: "Full name", value: name, onChange: setName, type: "text", placeholder: "Your full name" },
                { label: "Phone number", value: phone, onChange: setPhone, type: "tel", placeholder: "+234 800 000 0000" },
              ].map((field) => (
                <div key={field.label}>
                  <label className="mb-1.5 block text-body-sm font-medium text-ink">{field.label}</label>
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-body text-ink placeholder-ink-muted outline-none transition-colors focus:border-green focus:ring-3 focus:ring-green/20"
                  />
                </div>
              ))}

              <ProfileLocation />
              <ProfileReliability />

              <div>
                <label className="mb-1.5 block text-body-sm font-medium text-ink">Bio <span className="text-ink-muted font-normal">(optional)</span></label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="Tell buyers or farmers about yourself…"
                  className="w-full resize-none rounded-lg border border-line bg-paper px-3.5 py-2.5 text-body text-ink placeholder-ink-muted outline-none transition-colors focus:border-green focus:ring-3 focus:ring-green/20"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button type="submit" className="rounded-lg bg-green px-5 py-2.5 text-body font-medium text-paper hover:bg-green-hover">
                Save changes
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-body-sm text-success">
                  <CheckCircle2 strokeWidth={2} className="size-4" /> Saved
                </span>
              )}
            </div>
          </form>
        </Reveal>

        {/* Right: account + danger */}
        <div className="flex flex-col gap-4">
          <Reveal effect="riseIn">
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
              <h3 className="text-body font-medium text-ink">Connected Accounts</h3>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-paper px-4 py-3">
                <div className="flex items-center gap-3">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z" />
                  </svg>
                  <div>
                    <p className="text-body-sm font-medium text-ink">Google</p>
                    <p className="text-label text-ink-muted">{email}</p>
                  </div>
                </div>
                <CheckCircle2 strokeWidth={2} className="size-4 text-success" />
              </div>
            </div>
          </Reveal>

          <Reveal effect="riseIn">
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
              <h3 className="text-body font-medium text-ink">Account</h3>
              <div className="mt-3 space-y-1">
                <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-body-sm text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink">
                  <LogOut strokeWidth={1.5} className="size-4 shrink-0" /> Sign out
                </button>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-body-sm text-danger transition-colors hover:bg-danger/10">
                  <Trash2 strokeWidth={1.5} className="size-4 shrink-0" /> Delete account
                </button>
              </div>
            </div>
          </Reveal>

          <Reveal effect="riseIn">
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
              <h3 className="text-body font-medium text-ink">Security</h3>
              <p className="mt-1 text-body-sm text-ink-muted">
                A 4-digit PIN is required to authorise withdrawals and sensitive actions.
              </p>
              <button
                onClick={() => setPinOpen(true)}
                className="mt-4 flex w-full items-center gap-3 rounded-lg border border-line px-4 py-3 text-body-sm font-medium text-ink transition-colors hover:bg-sage-soft"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-green/10 text-green text-label font-bold tracking-widest">
                  ••••
                </span>
                Set / change transaction PIN
              </button>
            </div>
          </Reveal>
        </div>
      </div>

      {pinOpen && (
        <TransactionPinModal
          mode="set"
          onSuccess={() => setPinOpen(false)}
          onClose={() => setPinOpen(false)}
        />
      )}
    </div>
  );
}
