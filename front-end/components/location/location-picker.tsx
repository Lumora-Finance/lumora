"use client";

import { LoaderCircle, LocateFixed, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AREAS, nearestArea, TOP_AREAS } from "@/lib/logistics/areas";
import { captureLocation, CAPTURE_MESSAGES } from "@/lib/logistics/capture-location";
import { cn } from "@/lib/utils";

export type PickedLocation =
  | { kind: "gps"; lat: number; lng: number; accuracyM: number | null; area: string }
  | { kind: "area"; area: string };

const AREA_BUTTON =
  "min-h-12 rounded-2xl border border-line bg-white px-3 py-2 text-center text-base font-medium text-ink transition-colors duration-200 ease-out hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50";

/**
 * "Use my location" and the area buttons. People never type coordinates. If location is refused or
 * fails, the area buttons are right there, so nothing here can stop someone carrying on.
 */
export function LocationPicker({
  onPick,
  disabled = false,
}: {
  onPick: (location: PickedLocation) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [found, setFound] = useState<Extract<PickedLocation, { kind: "gps" }> | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [query, setQuery] = useState("");

  async function useMyLocation() {
    setLocating(true);
    setMessage(null);
    const result = await captureLocation();
    setLocating(false);
    if (result.status !== "ok") {
      setMessage(CAPTURE_MESSAGES[result.status]);
      return;
    }
    setFound({
      kind: "gps",
      lat: result.lat,
      lng: result.lng,
      accuracyM: result.accuracyM,
      area: nearestArea(result).name,
    });
  }

  if (found) {
    return (
      <div>
        <p className="text-lg font-medium text-ink" role="status">
          We found you near {found.area}. Is that right?
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button size="lg" className="h-12 rounded-full text-base" disabled={disabled} onClick={() => onPick(found)}>
            Yes
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 rounded-full text-base"
            disabled={disabled}
            onClick={() => setFound(null)}
          >
            Change
          </Button>
        </div>
      </div>
    );
  }

  const matches = AREAS.filter((area) => area.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      <Button size="lg" className="h-14 w-full rounded-full text-base" disabled={locating || disabled} onClick={useMyLocation}>
        {locating ? (
          <LoaderCircle aria-hidden="true" strokeWidth={1.5} className="size-5 animate-spin motion-reduce:animate-none" />
        ) : (
          <LocateFixed aria-hidden="true" strokeWidth={1.5} className="size-5" />
        )}
        {locating ? "Finding you…" : "Use my location"}
      </Button>
      {message && (
        <p role="status" className="mt-3 text-ink">
          {message}
        </p>
      )}

      <p className="mt-6 mb-3 text-ink-muted">or choose your area</p>
      {showMore ? (
        <>
          <label className="relative block">
            <span className="sr-only">Search areas</span>
            <Search aria-hidden="true" strokeWidth={1.5} className="absolute top-3.5 left-3 size-5 text-ink-muted" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type your area"
              className="h-12 w-full rounded-2xl border border-line bg-white pr-3 pl-10 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <ul className="mt-3 grid gap-2">
            {matches.map((area) => (
              <li key={area.name}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick({ kind: "area", area: area.name })}
                  className={cn(AREA_BUTTON, "w-full text-left")}
                >
                  {area.name}
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="py-2 text-ink-muted">We don&apos;t have that area yet.</li>}
          </ul>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {TOP_AREAS.map((area) => (
            <button
              key={area.name}
              type="button"
              disabled={disabled}
              onClick={() => onPick({ kind: "area", area: area.name })}
              className={AREA_BUTTON}
            >
              {area.name}
            </button>
          ))}
          <button type="button" onClick={() => setShowMore(true)} className={cn(AREA_BUTTON, "col-span-2 border-dashed")}>
            More areas
          </button>
        </div>
      )}
    </div>
  );
}

/** The body our location routes expect. */
export function locationBody(location: PickedLocation) {
  return location.kind === "gps"
    ? { lat: location.lat, lng: location.lng, accuracyM: location.accuracyM }
    : { area: location.area };
}
