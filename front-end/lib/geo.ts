export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
/** Roads wind. Straight-line distance times this is a fair guess at the distance by road. */
const ROAD_FACTOR = 1.3;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** An estimate of the distance by road, to the nearest km. */
export function roadKm(a: LatLng, b: LatLng): number {
  return Math.round(haversineKm(a, b) * ROAD_FACTOR);
}

/** The nearest of the given places, by straight line. */
export function nearest<T extends LatLng>(point: LatLng, places: readonly T[]): T {
  if (places.length === 0) throw new Error("No places to compare");
  let best = places[0];
  let bestDistance = haversineKm(point, best);
  for (const place of places.slice(1)) {
    const distance = haversineKm(point, place);
    if (distance < bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
}
