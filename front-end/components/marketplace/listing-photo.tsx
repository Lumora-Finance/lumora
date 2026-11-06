"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The first photo a buyer added to their demand. With no photo, or one that won't load, this renders
 * nothing, so the card simply reads as it would without one.
 */
export function ListingPhoto({ images, alt, className }: { images?: string[]; alt: string; className?: string }) {
  const url = images?.[0];
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) return null;

  return (
    <span className={cn("relative block overflow-hidden bg-sage-soft", className)}>
      {/* Out of the flow, so a photo's own size can't stretch a card past a phone's screen. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(url)}
        className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
    </span>
  );
}
