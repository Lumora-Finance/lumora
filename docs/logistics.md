# Delivery logistics and location

Lumora doesn't run transport: the farmer delivers or the buyer collects. For engineers working on the board, SMS or onboarding. Builds on `docs/money-flow.md`.

## What exists

| Area | Where |
|---|---|
| Areas, distance | `areas` table, `lib/geo.ts` (haversine × 1.3, rounded), `lib/logistics/areas.ts` |
| Location capture | `components/location/*`, `/onboarding`, profile, `/dashboard/agent/add-farmer` |
| SMS sign-up | `lib/logistics/sms-onboarding.ts` (unknown number or `JOIN`) |
| Board | `/dashboard/board`, `components/board/market-board.tsx`, `crate-card.tsx`, `lib/logistics/board.ts`, `crate.ts`, `lib/pricing.ts` |
| Listing form | `/dashboard/listings/new`, `logistics_create_listing` |
| Delivery form | `/dashboard/bookings/[id]/record`, `logistics_record_delivery` |
| Privacy | `user_locations` and `listing_private`, read through `logistics_booking_contact` |

## How privacy works

Exact coordinates, addresses and phones live in tables clients can't read for anyone but themselves. `demand_listings` stays public for the board, so the delivery address is in `listing_private`. The board and SMS list work from area names and centroids, so a distance reveals nothing exact.

The other party's details come only from `logistics_booking_contact`, which checks the viewer is on the booking and that it's still live. It stops answering once a booking is released, cancelled or a no-show.

## Decisions to check

| Gap | Decision |
|---|---|
| The two briefs describe the board differently ("Caterer D · Angwan Rukuba · 9 km" with a "Collects" label, then plain language) | The plain-language version, as it's the later and more specific one |
| `SELL 1 20` has no day, while `BOOK` took one | The day is optional. Without one, it takes the day shown on the list |
| `BOOK <n>` needs a list, and `BUYERS` needs a crop | `BUYERS` with no crop lists everything. Crops match on plain names too, so `BUYERS CHICKEN` works |
| A number could be typed by someone who doesn't own it | **Open.** Phone numbers from `/onboarding` aren't verified, yet SMS treats a phone number as identity. It needs an OTP before real money |
| Highest-price sort mixes units | ₦28,000 a basket sorts above ₦3,800 a kg. It reads fine with one crop at a time, but a crop filter would be better |
| Delivery photos | Stored in a public bucket under random names, so they aren't listed but anyone with the link can see them |
| Farmer fee on take-home | Settlement charges farmers nothing, so `FARMER_FEE_PCT` in `lib/pricing.ts` is 0, with no free-delivery count. A fee has to change there and in settlement together |
| My flock stepper | It only changes what the page works out, and isn't saved. Declared stock is its starting value |
| Listings are for one day | The form creates one day at a time. Recurring days from the README aren't built |

## Before this works for real

- Apply the migrations to Supabase. The `delivery-photos` bucket is created by the migration
- Set `SUPABASE_SERVICE_ROLE_KEY`, and let Supabase trust Firebase tokens
- Give agents the `agent` role. There's no screen for this, and no link to the Add a farmer page either
- HTTPS is required for "Use my location" everywhere except localhost

Until the API can answer, `/dashboard/board` shows examples labelled as examples, and `/onboarding` moves on to the dashboard rather than trapping anyone.

## PILOT follow-ups, not built

These are from the brief, and nothing has been started.

- [ ] **Net price.** Optional `transport_cost_per_trip_kobo` on the farmer profile. Board rows add "≈ ₦X/kg after transport" (price − cost ÷ (booked qty × average spec weight)), plus a "best net price" sort. Transport is zero for `buyer_collects`.
- [ ] **COST SMS.** After a payout, send "How much did transport cost? Reply COST 4000". Store `transport_cost_kobo` on the delivery, and `transport_mode` if given (bus, tricycle, pickup, own_vehicle, buyer_vehicle).
- [ ] **Logistics report at `/admin/logistics`.** Deliveries by route (farmer area → buyer area) with count, average distance, average transport cost, on-time rate (code validated inside the window) and declined units by reason. CSV export.
- [ ] **Shared transport interest.** A checkbox on the farmer profile, and a count per area on the report.
- [ ] **Map pin correction.** Optional Leaflet and OpenStreetMap map after "Use my location", to drag the pin. Not built, as the brief allowed.

## Seed data to check with local farmers

Coordinates came from OpenStreetMap, once, while writing the seed. The app calls no geocoder.

| Item | Why it needs checking |
|---|---|
| Beach Road | **Not found on OpenStreetMap. 9.905, 8.900 is my estimate** |
| Barkin Ladi | OpenStreetMap only gave the whole district, so 9.533, 8.900 is my estimate of the town |
| Rayfield, Angwan Rukuba, Tudun Wada, Angwan Rogo, Terminus | These are one landmark each (a lake, churches, a mosque, a market), not the middle of the area |
| Farin Gada, Bauchi Road | A point on the road, which may be far from where farms are |
| Area list | Are these where farmers actually are? It's a mix of town and farm areas, and Riyom, Mangu or Vom may matter more |
| SMS menu order | Bukuru, Barkin Ladi, Rayfield, Angwan Rukuba, Tudun Wada, from the brief |
| Crate limit | 10 per crate for broilers and turkey. A turkey is much bigger, so 10 looks high |
| 11:00 latest delivery | For live birds, does it hold in cool Jos as well as in the heat? |
| Road factor 1.3 | Could run low for hilly or rural routes, particularly to Barkin Ladi |
