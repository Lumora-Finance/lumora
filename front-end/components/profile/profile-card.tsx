"use client";

import { BadgeCheck, Bean, Bird, Bookmark, Briefcase, CalendarDays, Check, Egg, Fish, Link2, MapPin, Sprout, Star, Wheat } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { gsap, isReducedMotion } from "@/lib/gsap/effects";
import { cn } from "@/lib/utils";

import { HILLS_ACTION, HillsCard, HillsStats } from "./hills-card";

const SAVED_KEY = "lumora-saved-profiles";
const MOST_PRODUCE = 4;
const CORNER =
  "flex size-12 items-center justify-center rounded-full bg-white text-ink transition-transform duration-200 ease-out hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 motion-reduce:transition-none sm:size-14";

function produceIcon(name: string) {
  const word = name.toLowerCase();
  if (/broiler|turkey|chicken|bird|poultry/.test(word)) return Bird;
  if (/egg/.test(word)) return Egg;
  if (/fish|catfish|tilapia/.test(word)) return Fish;
  if (/maize|corn|rice|wheat|millet|sorghum|grain/.test(word)) return Wheat;
  if (/bean|soy|groundnut/.test(word)) return Bean;
  return Sprout;
}

/** The top of a profile: someone else's from the marketplace, or your own. */
export function ProfileCard({
  name,
  lead,
  role,
  area,
  joined,
  photoUrl,
  verified,
  deliveries,
  posts,
  produce = [],
  note,
  corner,
  action,
}: {
  name: string;
  lead: string;
  role?: string | null;
  area?: string | null;
  joined?: string | null;
  photoUrl?: string | null;
  verified?: boolean;
  /** Null while they're still loading. */
  deliveries: number | null;
  posts: number | null;
  produce?: string[];
  note?: ReactNode;
  corner?: ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  const kinds = [...new Set(produce)];
  const icons = [...new Set(kinds.map(produceIcon))].slice(0, MOST_PRODUCE);

  return (
    <HillsCard corner={corner}>
      <div className="px-5 pt-24 pb-6 sm:px-10 sm:pt-28 sm:pb-9 lg:px-14 lg:pt-36 lg:pb-11">
        <div data-card="avatar" className="relative size-24 overflow-hidden rounded-full bg-white ring-[5px] ring-white sm:size-28 lg:size-32">
          {photoUrl ? (
            <Image src={photoUrl} alt="" fill unoptimized referrerPolicy="no-referrer" sizes="128px" className="object-cover" />
          ) : (
            <span aria-hidden="true" className="flex size-full items-center justify-center bg-sage-soft text-[32px] font-medium text-green lg:text-[40px]">
              {initials}
            </span>
          )}
        </div>

        <div data-card="rise" className="mt-4 flex min-w-0 items-center gap-2 sm:mt-5">
          <h1 className="min-w-0 text-[26px] leading-tight font-medium tracking-tight break-words text-ink sm:text-[34px]">{name}</h1>
          {verified && <BadgeCheck role="img" aria-label="Verified" strokeWidth={1.75} className="size-6 shrink-0 text-green" />}
        </div>
        <p data-card="rise" className="mt-1 text-body break-words text-ink/80">{lead}</p>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div data-card="rise" className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-body-sm text-ink-muted">
            {role && (
              <span className="flex items-center gap-1.5 capitalize">
                <Briefcase aria-hidden="true" strokeWidth={1.5} className="size-4" /> {role}
              </span>
            )}
            {area && (
              <span className="flex items-center gap-1.5">
                <MapPin aria-hidden="true" strokeWidth={1.5} className="size-4" /> {area}
              </span>
            )}
            {joined && (
              <span className="flex items-center gap-1.5">
                <CalendarDays aria-hidden="true" strokeWidth={1.5} className="size-4" /> Since {joined}
              </span>
            )}
            {note}
          </div>

          {icons.length > 0 && (
            <div className="flex items-center gap-3" title={kinds.join(", ")}>
              <div aria-hidden="true" className="flex items-center gap-1.5">
                {icons.map((Icon) => (
                  <span key={Icon.displayName} data-card="icon" className="flex size-7 items-center justify-center rounded-full bg-field text-paper">
                    <Icon strokeWidth={1.75} className="size-3.5" />
                  </span>
                ))}
              </div>
              <span data-card="rise" className="text-body font-medium text-ink">Produce</span>
              <span className="sr-only">{kinds.join(", ")}</span>
            </div>
          )}
        </div>

        <div className="mt-7 flex flex-col gap-6 sm:mt-9 sm:flex-row sm:items-center sm:justify-between">
          <HillsStats
            stats={[
              { value: <span className="inline-flex items-center gap-1.5"><Star aria-hidden="true" className="size-[18px] fill-ink text-ink" /> New</span>, label: "rating" },
              { value: deliveries, label: deliveries === 1 ? "delivery" : "deliveries" },
              { value: posts, label: posts === 1 ? "active post" : "active posts" },
            ]}
          />

          {action && (
            <div data-card="pop" className="sm:shrink-0">
              {action.href ? (
                <Link href={action.href} className={HILLS_ACTION}>{action.label}</Link>
              ) : (
                <button type="button" onClick={action.onClick} className={HILLS_ACTION}>{action.label}</button>
              )}
            </div>
          )}
        </div>
      </div>
    </HillsCard>
  );
}

function readSaved(): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/** Remembers a profile on this device. Only mounts in the browser, once the profile has loaded. */
export function SaveProfileButton({ id }: { id: string }) {
  const [saved, setSaved] = useState(() => readSaved().includes(id));
  const icon = useRef<SVGSVGElement>(null);

  function toggle() {
    const next = !saved;
    setSaved(next);
    try {
      const others = readSaved().filter((one) => one !== id);
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next ? [...others, id] : others));
    } catch {
      // Private windows can refuse storage. The button still answers for this visit.
    }
    if (!isReducedMotion()) gsap.fromTo(icon.current, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: "back.out(3)" });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save this profile"}
      className={CORNER}
    >
      <Bookmark ref={icon} aria-hidden="true" strokeWidth={1.75} className={cn("size-5 sm:size-6", saved && "fill-ink")} />
    </button>
  );
}

/** Your own profile has nothing to save, so the corner copies the link people see instead. */
export function CopyProfileLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/dashboard/profile/${id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} aria-label={copied ? "Link copied" : "Copy link to your profile"} className={CORNER}>
      {copied ? <Check aria-hidden="true" strokeWidth={2} className="size-5 text-green sm:size-6" /> : <Link2 aria-hidden="true" strokeWidth={1.75} className="size-5 sm:size-6" />}
    </button>
  );
}
