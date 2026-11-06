"use client";

import { ExternalLink, Sparkles, TrendingUp, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";
import type { AiMatch, AiScanResult } from "@/app/api/ai-scan/route";

// ─── Phases ───────────────────────────────────────────────────────────────────
type Phase = "idle" | "scanning" | "done" | "empty";

// ─── Scanning lines animation texts ──────────────────────────────────────────
const SCAN_LINES_DEMAND = [
  "Scanning active supply listings…",
  "Querying farmer network…",
  "Checking nearby producers…",
  "Matching commodity specifications…",
  "Analysing price points…",
  "Cross-referencing areas…",
];

const SCAN_LINES_SUPPLY = [
  "Scanning active demand listings…",
  "Querying buyer network…",
  "Checking standing orders…",
  "Matching commodity requirements…",
  "Analysing price ranges…",
  "Cross-referencing areas…",
];

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  commodity: string;
  /** demand = buyer form; supply = farmer form */
  mode: "demand" | "supply";
  userToken: string | null;
};

// ─── Scanning line ticker ─────────────────────────────────────────────────────
function ScanTicker({ mode }: { mode: "demand" | "supply" }) {
  const lines = mode === "demand" ? SCAN_LINES_DEMAND : SCAN_LINES_SUPPLY;
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % lines.length);
        setVisible(true);
      }, 200);
    }, 900);
    return () => clearInterval(interval);
  }, [lines.length]);

  return (
    <span
      className={cn(
        "font-mono text-[11px] text-green/80 transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      {lines[idx]}
    </span>
  );
}

// ─── Radar rings animation ────────────────────────────────────────────────────
function RadarRings() {
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute inline-flex size-full rounded-full border border-green/40 opacity-0"
          style={{
            animation: `lumora-radar-ping 2s cubic-bezier(0, 0, 0.2, 1) ${i * 0.6}s infinite`,
          }}
        />
      ))}
      <span className="relative flex size-5 items-center justify-center rounded-full bg-sage-soft">
        <Sparkles strokeWidth={1.5} className="size-3 text-green" />
      </span>
    </div>
  );
}

// ─── Match card ───────────────────────────────────────────────────────────────
function MatchCard({ match, index, mode }: { match: AiMatch; index: number; mode: "demand" | "supply" }) {
  const isDemand = match.kind === "demand";

  return (
    <a
      href={match.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-xl border border-line bg-white p-3.5 transition-all duration-200 hover:border-green/40 hover:shadow-md hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-green/40 focus-visible:outline-none"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Icon */}
      <div className={cn(
        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
        isDemand ? "bg-amber-soft" : "bg-sage-soft",
      )}>
        {isDemand
          ? <Users strokeWidth={1.5} className="size-4 text-amber-700" />
          : <TrendingUp strokeWidth={1.5} className="size-4 text-green" />
        }
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink leading-tight">{match.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-ink-muted">{match.detail}</p>
        <p className="mt-1 font-mono text-xs font-semibold text-green">{match.price_display}</p>
      </div>

      {/* External link icon */}
      <ExternalLink
        strokeWidth={1.5}
        className="mt-0.5 size-3.5 shrink-0 text-ink-muted/40 transition-colors group-hover:text-green"
      />
    </a>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ScanProgressBar() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    // Animate width 0 → 85% over 2.5s, then hold
    el.style.width = "0%";
    el.style.transition = "none";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "width 2.5s cubic-bezier(0.16, 1, 0.3, 1)";
        el.style.width = "85%";
      });
    });
  }, []);

  return (
    <div className="h-0.5 w-full overflow-hidden rounded-full bg-line">
      <div ref={bar} className="h-full rounded-full bg-green" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AiScan({ commodity, mode, userToken }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [matches, setMatches] = useState<AiMatch[]>([]);
  const prevCommodity = useRef("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!commodity || commodity === prevCommodity.current) return;
    prevCommodity.current = commodity;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("scanning");
    setMatches([]);

    // Minimum scan duration for the animation to feel real
    const MIN_SCAN_MS = 2200;
    const started = Date.now();

    async function scan() {
      try {
        const token = userToken ?? (await getToken().catch(() => null));
        const url = `/api/ai-scan?commodity=${encodeURIComponent(commodity)}&mode=${mode}`;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as AiScanResult;

        // Pad to minimum scan time so the animation has room to breathe
        const elapsed = Date.now() - started;
        if (elapsed < MIN_SCAN_MS) {
          await new Promise((r) => setTimeout(r, MIN_SCAN_MS - elapsed));
        }

        if (controller.signal.aborted) return;
        setMatches(data.matches);
        setPhase(data.matches.length > 0 ? "done" : "empty");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setPhase("empty");
      }
    }

    scan();
    return () => controller.abort();
  }, [commodity, mode, userToken]);

  if (phase === "idle") return null;

  return (
    <>
      {/* Keyframe injection — only inserted once */}
      <style>{`
        @keyframes lumora-radar-ping {
          0%   { transform: scale(0.4); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes lumora-match-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className={cn(
          "overflow-hidden rounded-2xl border transition-all duration-500",
          phase === "scanning"
            ? "border-green/30 bg-field/[0.03]"
            : phase === "done"
            ? "border-green/20 bg-sage-soft/30"
            : "border-line bg-paper/60",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          {phase === "scanning" ? (
            <RadarRings />
          ) : (
            <div className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              phase === "done" ? "bg-sage-soft" : "bg-line",
            )}>
              <Sparkles strokeWidth={1.5} className={cn(
                "size-4",
                phase === "done" ? "text-green" : "text-ink-muted",
              )} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {phase === "scanning" && (
              <>
                <p className="text-sm font-medium text-ink">
                  Lumora AI is scanning…
                </p>
                <ScanTicker mode={mode} />
              </>
            )}
            {phase === "done" && (
              <p className="text-sm font-medium text-ink">
                Found{" "}
                <span className="font-mono text-green">{matches.length}</span>{" "}
                {mode === "demand"
                  ? `farmer${matches.length !== 1 ? "s" : ""} selling ${commodity}`
                  : `buyer${matches.length !== 1 ? "s" : ""} wanting ${commodity}`}
              </p>
            )}
            {phase === "empty" && (
              <p className="text-sm text-ink-muted">
                No active{" "}
                {mode === "demand" ? "supply listings" : "demand listings"} found for{" "}
                <span className="font-medium text-ink">{commodity}</span> yet.
              </p>
            )}
          </div>

          {/* Dot indicator */}
          <span className={cn(
            "size-2 shrink-0 rounded-full",
            phase === "scanning" && "animate-pulse bg-green",
            phase === "done" && "bg-green",
            phase === "empty" && "bg-ink-muted/30",
          )} />
        </div>

        {/* Progress bar while scanning */}
        {phase === "scanning" && (
          <div className="px-4 pb-3">
            <ScanProgressBar />
          </div>
        )}

        {/* Results */}
        {phase === "done" && matches.length > 0 && (
          <div className="flex flex-col gap-2 px-4 pb-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted/70">
              {mode === "demand" ? "Active supply — click to view" : "Active demand — click to view"}
            </p>
            {matches.map((match, i) => (
              <div
                key={match.id}
                style={{
                  animation: `lumora-match-in 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 70}ms both`,
                }}
              >
                <MatchCard match={match} index={i} mode={mode} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
