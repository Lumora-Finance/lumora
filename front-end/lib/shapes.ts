/**
 * Clip-path shapes for the hero story's photo. Every shape has the same number of points,
 * starts at the top centre and runs clockwise, so GSAP can tween one into the other.
 */
type Point = [number, number];

export const SHAPE_POINTS = 48;
const QUARTER_POINTS = SHAPE_POINTS / 4;
const CORNER_POINTS = 5;

const KERNEL_SEGMENTS: [Point, Point, Point, Point][] = [
  [[0, -58], [42, -29], [42, 29], [0, 58]],
  [[0, 58], [-42, 29], [-42, -29], [0, -58]],
];

function cubic([a, b, c, d]: [Point, Point, Point, Point], t: number): Point {
  const u = 1 - t;
  const at = (i: 0 | 1) =>
    u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i];
  return [at(0), at(1)];
}

/** Picks `count` points evenly spaced along a closed outline. */
function resample(outline: Point[], count: number): Point[] {
  const closed = [...outline, outline[0]];
  const lengths = [0];
  for (let i = 1; i < closed.length; i++) {
    lengths.push(
      lengths[i - 1] + Math.hypot(closed[i][0] - closed[i - 1][0], closed[i][1] - closed[i - 1][1]),
    );
  }
  const total = lengths[lengths.length - 1];

  let segment = 1;
  return Array.from({ length: count }, (_, index) => {
    const distance = (index / count) * total;
    while (lengths[segment] < distance) segment++;
    const span = lengths[segment] - lengths[segment - 1] || 1;
    const t = (distance - lengths[segment - 1]) / span;
    const [from, to] = [closed[segment - 1], closed[segment]];
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  });
}

/** The Lumora kernel, normalised to fill its box, as percentages. */
export function kernelPoints(count = SHAPE_POINTS): Point[] {
  const outline = KERNEL_SEGMENTS.flatMap((segment) =>
    Array.from({ length: 200 }, (_, i) => cubic(segment, i / 200)),
  );
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

  return resample(outline, count).map(([x, y]) => [
    ((x - minX) / (maxX - minX)) * 100,
    ((y - minY) / (maxY - minY)) * 100,
  ]);
}

/** A rounded rectangle for a box of the given pixel size, as percentages. */
export function roundedRectPoints(width: number, height: number, radius: number): Point[] {
  const r = Math.min(radius, width / 2, height / 2);
  const line = (from: Point, to: Point, count: number): Point[] =>
    Array.from({ length: count }, (_, i) => {
      const t = i / count;
      return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
    });
  const arc = (cx: number, cy: number, start: number): Point[] =>
    Array.from({ length: CORNER_POINTS }, (_, i) => {
      const angle = start + (i / (CORNER_POINTS - 1)) * (Math.PI / 2);
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });

  // Even spacing would step straight over the corners. Each quarter gets the same number of
  // points as a quarter of the kernel instead, with a fixed share on its corner.
  const straight = QUARTER_POINTS - CORNER_POINTS;
  const halfTop = width / 2 - r;
  const halfSide = height / 2 - r;
  const topCount = Math.min(straight - 1, Math.max(1, Math.round((straight * halfTop) / (halfTop + halfSide))));
  const sideCount = straight - topCount;
  const [w, h] = [width, height];

  const outline: Point[] = [
    ...line([w / 2, 0], [w - r, 0], topCount),
    ...arc(w - r, r, -Math.PI / 2),
    ...line([w, r], [w, h / 2], sideCount).map((p, i) => (i === 0 ? ([w, r + halfSide / sideCount] as Point) : p)),

    ...line([w, h / 2], [w, h - r], sideCount),
    ...arc(w - r, h - r, 0),
    ...line([w - r, h], [w / 2, h], topCount).map((p, i) => (i === 0 ? ([w - r - halfTop / topCount, h] as Point) : p)),

    ...line([w / 2, h], [r, h], topCount),
    ...arc(r, h - r, Math.PI / 2),
    ...line([0, h - r], [0, h / 2], sideCount).map((p, i) => (i === 0 ? ([0, h - r - halfSide / sideCount] as Point) : p)),

    ...line([0, h / 2], [0, r], sideCount),
    ...arc(r, r, Math.PI),
    ...line([r, 0], [w / 2, 0], topCount).map((p, i) => (i === 0 ? ([r + halfTop / topCount, 0] as Point) : p)),
  ];

  return outline.map(([x, y]) => [(x / width) * 100, (y / height) * 100]);
}

export function toPolygon(points: Point[]) {
  return `polygon(${points.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(", ")})`;
}
