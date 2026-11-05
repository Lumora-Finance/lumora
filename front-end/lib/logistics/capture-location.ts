export type CaptureResult =
  | { status: "ok"; lat: number; lng: number; accuracyM: number | null }
  | { status: "denied" | "timeout" | "unavailable" };

type GeolocationLike = Pick<Geolocation, "getCurrentPosition">;

/** Asks the device where it is. Never throws: every failure is a result the screen can handle. */
export function captureLocation(
  geolocation: GeolocationLike | undefined = typeof navigator === "undefined" ? undefined : navigator.geolocation,
): Promise<CaptureResult> {
  return new Promise((resolve) => {
    if (!geolocation) {
      resolve({ status: "unavailable" });
      return;
    }
    try {
      geolocation.getCurrentPosition(
        ({ coords }) =>
          resolve({
            status: "ok",
            lat: coords.latitude,
            lng: coords.longitude,
            accuracyM: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
          }),
        (error) => {
          // The numeric codes, because a GeolocationPositionError isn't constructible in tests.
          if (error.code === 1) resolve({ status: "denied" });
          else if (error.code === 3) resolve({ status: "timeout" });
          else resolve({ status: "unavailable" });
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
      );
    } catch {
      resolve({ status: "unavailable" });
    }
  });
}

export const CAPTURE_MESSAGES: Record<Exclude<CaptureResult["status"], "ok">, string> = {
  denied: "No problem. Just choose your area below.",
  timeout: "We couldn't find you just now. Just choose your area below.",
  unavailable: "We can't use location on this phone. Just choose your area below.",
};
