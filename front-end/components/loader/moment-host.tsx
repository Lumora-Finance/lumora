"use client";

import { endMoment, markLoaderSeen, useCurrentMoment } from "@/lib/loading/moment";

import { LumoraLoader } from "./LumoraLoader";

/** Plays key moments. In the root layout, because a moment can carry someone from one page to another. */
export function MomentHost() {
  const moment = useCurrentMoment();
  if (!moment) return null;
  return (
    <LumoraLoader
      key={moment.id}
      label={moment.label}
      work={moment.work}
      whenCovered={() => {
        // A moment that navigates to the dashboard has already done the first-load sequence's job.
        markLoaderSeen();
        moment.whenCovered?.();
      }}
      onDone={endMoment}
    />
  );
}
