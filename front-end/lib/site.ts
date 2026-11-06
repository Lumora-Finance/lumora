export const SITE_NAME = "Lumora";
export const SITE_TAGLINE = "Buyers are waiting. What are you selling?";
export const SITE_DESCRIPTION =
  "A demand board for farm produce in Jos and Plateau State. Buyers post what they need and what they'll pay. Farmers book it before they load the truck.";

function resolveSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

/** Absolute site origin, with no trailing slash. */
export const SITE_URL = resolveSiteUrl().replace(/\/$/, "");
