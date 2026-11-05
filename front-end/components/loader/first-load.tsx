"use client";

import { useState, useSyncExternalStore } from "react";

import { loadingMessage } from "@/lib/loading-messages";
import { loaderSeen, markLoaderSeen, type MomentFinal } from "@/lib/loading/moment";
import { loadingArea, taskCounts, whenTasksSettle } from "@/lib/loading/progress";

import { LumoraLoader } from "./LumoraLoader";

const noSubscribe = () => () => {};
const NEVER = new Promise<MomentFinal>(() => {});
const currentLabel = () => loadingMessage(location.pathname);
const serverLabel = () => loadingMessage("/dashboard");

async function firstLoadFinal(): Promise<MomentFinal> {
  await whenTasksSettle();
  const { total, done } = taskCounts();
  const area = loadingArea();
  return {
    top: total > 0 ? `${done} of ${total}` : "Ready",
    line: area ? `Buyers near ${area} ready` : "Your day is ready",
    fraction: 1,
    number: total > 0 ? done : undefined,
  };
}

/**
 * The full sequence, once per tab, on first load and after signing in. It's in the server's HTML so the page
 * can't flash first. A tab that's already had it is hidden by the script in the root layout, before paint.
 */
export function FirstLoad() {
  const seen = useSyncExternalStore(noSubscribe, loaderSeen, () => false);
  const [finished, setFinished] = useState(false);
  // Prerendered with the page, so the server only draws it. The waiting starts in the browser.
  const [work] = useState(() => (typeof window === "undefined" ? NEVER : firstLoadFinal()));
  const label = useSyncExternalStore(noSubscribe, currentLabel, serverLabel);

  if (seen || finished) return null;

  return (
    <div className="lumora-first-cover">
      <LumoraLoader
        label={label}
        work={work}
        timing="first"
        progress={() => {
          const { total, done } = taskCounts();
          return total > 0 ? done / total : 0;
        }}
        onDone={() => {
          markLoaderSeen();
          setFinished(true);
        }}
      />
    </div>
  );
}
