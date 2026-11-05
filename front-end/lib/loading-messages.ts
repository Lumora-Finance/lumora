/**
 * What the loader says on the way to a route. Plain words, no jokes and no ellipses. Most specific first.
 * A name is only used when it's known, so nobody reads "near undefined".
 */
const near = (area?: string | null) => (area ? `near ${area}` : "near you");

const ROUTES: { match: RegExp; message: (area?: string | null) => string }[] = [
  { match: /^\/dashboard\/?$/, message: () => "Getting your day ready" },
  { match: /^\/(dashboard\/board|buyers)\b/, message: (area) => `Finding buyers ${near(area)}` },
  { match: /^\/dashboard\/bookings\/[^/]+\/record/, message: () => "Opening the weigh-in" },
  { match: /^\/dashboard\/bookings\/[^/]+/, message: () => "Opening your booking" },
  { match: /^\/dashboard\/bookings/, message: () => "Loading your bookings" },
  { match: /^\/dashboard\/wallet/, message: () => "Checking your balance" },
  { match: /^\/dashboard\/marketplace\/[^/]+/, message: () => "Opening this post" },
  { match: /^\/dashboard\/marketplace/, message: (area) => `Finding demand ${near(area)}` },
  { match: /^\/dashboard\/messages/, message: () => "Loading your messages" },
  { match: /^\/dashboard\/transactions/, message: () => "Loading your money" },
  { match: /^\/dashboard\/posts/, message: () => "Loading your posts" },
  { match: /^\/dashboard\/listings\/new/, message: () => "Opening your new post" },
  { match: /^\/dashboard\/profile/, message: () => "Loading your profile" },
  { match: /^\/dashboard\/agent/, message: () => "Opening farmer sign-up" },
  { match: /^\/onboarding\/finish/, message: () => "Setting up your board" },
  { match: /^\/onboarding/, message: () => "Getting you started" },
  { match: /^\/admin/, message: () => "Checking access" },
  { match: /^\/action/, message: () => "Opening your booking" },
];

export function loadingMessage(pathname: string, area?: string | null): string {
  return ROUTES.find((route) => route.match.test(pathname))?.message(area) ?? "Loading";
}
