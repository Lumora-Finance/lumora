"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  alt: string;
};

/**
 * Full-width image gallery for listing detail pages.
 * Shows one large 16/9 main image with prev/next arrows, and a scrollable
 * thumbnail strip below. Single image renders as a plain banner with no controls.
 */
export function ImageGallery({ images, alt }: Props) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());

  if (!images || images.length === 0) return null;

  const valid = images.filter((_, i) => !failed.has(i));
  if (valid.length === 0) return null;

  // Map active index from "all images" to "valid images" space
  const validIndex = Math.min(active, valid.length - 1);
  const currentUrl = images[active] ?? valid[0];

  function prev() {
    setActive((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    setActive((i) => (i + 1) % images.length);
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-line bg-paper">
      {/* Main image */}
      <div className="group relative aspect-[16/9] w-full overflow-hidden bg-sage-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={currentUrl}
          src={currentUrl}
          alt={`${alt} — photo ${active + 1} of ${images.length}`}
          className="absolute inset-0 size-full object-cover transition-opacity duration-300"
          onError={() => setFailed((s) => new Set(s).add(active))}
        />

        {/* Arrows — only shown for multiple images */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-field/70 text-paper opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 hover:bg-field focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <ChevronLeft strokeWidth={2} className="size-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-field/70 text-paper opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 hover:bg-field focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <ChevronRight strokeWidth={2} className="size-5" />
            </button>

            {/* Dot indicator */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Go to photo ${i + 1}`}
                  className={cn(
                    "size-1.5 rounded-full transition-all duration-200",
                    i === active ? "w-4 bg-white" : "bg-white/50 hover:bg-white/80",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip — only for 2+ images */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Photo ${i + 1}`}
              aria-pressed={i === active}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green",
                i === active
                  ? "border-green shadow-sm"
                  : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Thumbnail ${i + 1}`}
                className="size-full object-cover"
                onError={() => setFailed((s) => new Set(s).add(i))}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
