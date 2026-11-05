"use client";

import { X, TrendingUp, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MarketItem, Offer } from "@/lib/demo/market";

export function OfferModal({
  open,
  onClose,
  item,
  onMakeOffer,
}: {
  open: boolean;
  onClose: () => void;
  item: MarketItem | null;
  onMakeOffer: (offer: Offer) => void;
}) {
  const [qty, setQty] = useState(10);
  const [price, setPrice] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (item) {
      setQty(Math.min(10, item.remaining));
      // Suggest a price slightly below the asking price
      setPrice(Math.round(item.price * 0.97 / 100) * 100);
      setNote("");
    }
  }, [item]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !item) return null;

  // Generate 3 suggested prices
  const suggestions = [
    { label: "Below asking", price: Math.round(item.price * 0.95 / 100) * 100, desc: "₦" + Math.round(item.price * 0.95 / 100) * 100 + "/" + item.priceUnit },
    { label: "At asking", price: item.price, desc: "₦" + item.price + "/" + item.priceUnit, highlight: true },
    { label: "Above asking", price: Math.round(item.price * 1.05 / 100) * 100, desc: "₦" + Math.round(item.price * 1.05 / 100) * 100 + "/" + item.priceUnit },
  ];

  function submit() {
    if (!item) return;
    onMakeOffer({
      id: "o" + Date.now(),
      itemId: item.id,
      farmer: "You",
      area: "Your area",
      price,
      priceUnit: item.priceUnit,
      qty,
      unit: item.unit,
      unitPlural: item.unitPlural,
      note: note || `${qty} ${qty === 1 ? item.unit : item.unitPlural} at ₦${price}/${item.priceUnit}`,
      timeAgo: "Just now",
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-field/60 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-paper shadow-2xl"
        style={{ animation: "rise-in 300ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <h2 className="font-display text-title font-medium text-ink">Make an Offer</h2>
            <p className="mt-0.5 text-body-sm text-ink-muted">
              {item.commodity} · {item.poster}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-sage-soft hover:text-ink"
          >
            <X strokeWidth={1.5} className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-6">
          {/* AI suggestion banner */}
          <div className="flex items-start gap-3 rounded-xl bg-amber-soft/50 border border-amber/20 p-3.5">
            <Sparkles strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-amber" />
            <div>
              <p className="text-body-sm text-ink">
                <span className="font-medium">Market average:</span>{" "}
                <span className="font-num font-medium text-amber">₦{item.price}/{item.priceUnit}</span>
              </p>
              <p className="text-label text-ink-muted">
                {item.remaining} {item.unitPlural} still available
              </p>
            </div>
          </div>

          {/* Price suggestions */}
          <div>
            <p className="mb-2 text-body-sm font-medium text-ink">Suggested prices</p>
            <div className="grid grid-cols-3 gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setPrice(s.price)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-3 transition-all",
                    price === s.price
                      ? "border-green bg-sage-soft shadow-sm"
                      : "border-line hover:border-green",
                    s.highlight && price !== s.price && "border-amber/40",
                  )}
                >
                  <span className="text-label text-ink-muted">{s.label}</span>
                  <span className={cn("font-num text-body-sm font-medium", s.highlight ? "text-amber" : "text-ink")}>
                    {s.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom price */}
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-ink">
              Your price <span className="text-ink-muted">(₦/{item.priceUnit})</span>
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
              className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 font-num text-body text-ink outline-none focus:border-green focus:ring-3 focus:ring-green/20"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-ink">
              Quantity <span className="text-ink-muted">({item.unitPlural})</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty(Math.max(1, qty - 5))}
                className="flex size-10 items-center justify-center rounded-lg border border-line text-ink hover:border-green hover:text-green"
              >
                −5
              </button>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(item.remaining, parseInt(e.target.value) || 1)))}
                className="w-20 rounded-lg border border-line bg-white px-3 py-2.5 text-center font-num text-body text-ink outline-none focus:border-green focus:ring-3 focus:ring-green/20"
              />
              <button
                onClick={() => setQty(Math.min(item.remaining, qty + 5))}
                className="flex size-10 items-center justify-center rounded-lg border border-line text-ink hover:border-green hover:text-green"
              >
                +5
              </button>
              <span className="text-body-sm text-ink-muted">
                Max: {item.remaining}
              </span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1.5 block text-body-sm font-medium text-ink">
              Message <span className="text-ink-muted">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add a note about your produce, delivery time, or quality…"
              className="w-full resize-none rounded-lg border border-line bg-white px-3.5 py-2.5 text-body text-ink placeholder-ink-muted outline-none focus:border-green focus:ring-3 focus:ring-green/20"
            />
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between rounded-lg bg-sage-soft/50 px-4 py-3">
            <span className="text-body-sm text-ink-muted">Total value</span>
            <span className="font-num text-number font-medium text-green">
              ₦{(price * qty).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-line px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2.5 text-body-sm font-medium text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green py-2.5 text-body-sm font-medium text-paper hover:bg-green-hover"
          >
            <TrendingUp strokeWidth={1.5} className="size-4" />
            Submit offer
          </button>
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
