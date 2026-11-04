"use client";

import { ArrowRight, ShieldAlert, Wheat, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type PostOption = {
  type: "demand" | "listing";
  title: string;
  description: string;
  icon: React.ElementType;
  tag: string;
  tagStyle: string;
  requiresVerification?: boolean;
  verified?: boolean;
};

const OPTIONS: PostOption[] = [
  {
    type: "demand",
    title: "Post Demand",
    description: "You need produce — publish what you want, your price per unit and daily capacity. Farmers will book your slot.",
    icon: Wheat,
    tag: "For Buyers",
    tagStyle: "bg-green/10 text-green",
  },
  {
    type: "listing",
    title: "List Produce",
    description: "You have produce — list what you have, your price and quantity. Buyers can find and book you.",
    icon: Wheat,
    tag: "For Farmers",
    tagStyle: "bg-amber-soft text-amber",
    requiresVerification: true,
    verified: false, // swap with real verification status
  },
];

export function PostModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Trap scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-field/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal
        aria-labelledby="post-modal-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-paper shadow-2xl"
        style={{ animation: "rise-in 300ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <h2 id="post-modal-title" className="text-title font-display font-medium text-ink">
              What do you want to post?
            </h2>
            <p className="mt-0.5 text-body-sm text-ink-muted">Choose one to get started</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink"
          >
            <X strokeWidth={1.5} className="size-5" />
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 p-6">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const locked = opt.requiresVerification && !opt.verified;

            return (
              <button
                key={opt.type}
                disabled={locked}
                className={cn(
                  "group relative flex w-full items-start gap-4 overflow-hidden rounded-xl border p-5 text-left transition-all duration-200",
                  locked
                    ? "cursor-not-allowed border-line bg-line/20 opacity-70"
                    : "border-line bg-white hover:border-green hover:shadow-sm",
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    opt.type === "demand"
                      ? "bg-sage-soft text-green group-hover:bg-green group-hover:text-paper"
                      : "bg-amber-soft text-amber",
                    locked && "group-hover:bg-amber-soft group-hover:text-amber",
                  )}
                >
                  <Icon strokeWidth={1.5} className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{opt.title}</span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 font-num text-label font-medium",
                        opt.tagStyle,
                      )}
                    >
                      {opt.tag}
                    </span>
                  </div>
                  <p className="mt-1 text-body-sm text-ink-muted leading-relaxed">
                    {opt.description}
                  </p>

                  {locked && (
                    <p className="mt-2 flex items-center gap-1.5 text-body-sm text-amber">
                      <ShieldAlert strokeWidth={1.5} className="size-3.5 shrink-0" />
                      Verification required to list produce
                    </p>
                  )}
                </div>

                {!locked && (
                  <ArrowRight
                    strokeWidth={1.5}
                    className="mt-0.5 size-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-green"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Verification CTA */}
        <div className="border-t border-line bg-amber-soft/40 px-6 py-4">
          <p className="text-body-sm text-ink-muted">
            Want to list produce?{" "}
            <button className="font-medium text-amber underline-offset-4 hover:underline">
              Start verification →
            </button>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes rise-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
