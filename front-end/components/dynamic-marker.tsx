/**
 * DynamicMarker — server component that calls `connection()` to tell Next.js
 * this route segment uses runtime data and should not be statically prerendered.
 *
 * Usage: render inside a <Suspense> boundary anywhere in the route tree.
 */
import { connection } from "next/server";

export async function DynamicMarker() {
  await connection();
  return null;
}
