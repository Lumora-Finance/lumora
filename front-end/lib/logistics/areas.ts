import { nearest, type LatLng } from "@/lib/geo";

export type Area = LatLng & { name: string };

/** In the order farmers see them. Keep in step with the `areas` seed. A test fails if they differ. */
export const AREAS: readonly Area[] = [
  { name: "Bukuru", lat: 9.799912, lng: 8.866667 },
  { name: "Barkin Ladi", lat: 9.533, lng: 8.9 },
  { name: "Rayfield", lat: 9.839666, lng: 8.912744 },
  { name: "Angwan Rukuba", lat: 9.929486, lng: 8.909463 },
  { name: "Tudun Wada", lat: 9.897599, lng: 8.871352 },
  { name: "Beach Road", lat: 9.905, lng: 8.9 },
  { name: "Farin Gada", lat: 9.959185, lng: 8.868421 },
  { name: "Terminus", lat: 9.919084, lng: 8.88983 },
  { name: "Bauchi Road", lat: 9.936327, lng: 8.893449 },
  { name: "Angwan Rogo", lat: 9.946083, lng: 8.888239 },
];

export const TOP_AREAS = AREAS.slice(0, 6);
export const MORE_AREAS = AREAS.slice(6);

export const nearestArea = (point: LatLng) => nearest(point, AREAS);
export const isAreaName = (name: unknown): name is string => AREAS.some((area) => area.name === name);

/** A point this far from every area is a bad reading, or someone outside the pilot. */
export const inPilotRegion = ({ lat, lng }: LatLng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= 8.5 && lat <= 10.8 && lng >= 8 && lng <= 10.2;
