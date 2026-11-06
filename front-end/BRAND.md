# Lumora Brand Guide

This file is the source of truth for Lumora's visual identity and UI. Follow it exactly when setting up and building the project. When something is not covered here, choose the calmer, plainer option.

---

## 1. Brand in one paragraph

Lumora is a demand board for farm produce. Bulk buyers post what they need, the price per unit and their daily capacity; farmers see every bid, book a slot, deliver and get paid by weight. The name comes from *lumen* (light): Lumora makes hidden demand visible. The product should feel like a calm, trustworthy market board, closer to a fintech or exchange than to a farm-themed startup.

**Tagline:** Buyers are waiting. What are you selling?

---

## 2. Logo

The logo is **Rising Kernel**: an amber grain rising like the sun over three green ledger lines, with two thin cuts of light across the kernel.

### Files

Copy the logo pack into the project at `public/brand/`.

| File | Use |
|---|---|
| `lumora-mark.svg` | Mark alone on light backgrounds |
| `lumora-mark-dark-bg.svg` | Mark alone on dark backgrounds (sage lines) |
| `lumora-lockup.svg` | Stacked mark and wordmark, light backgrounds |
| `lumora-lockup-dark-bg.svg` | Stacked, dark backgrounds |
| `lumora-lockup-horizontal.svg` | Navbar and headers, light backgrounds |
| `lumora-lockup-horizontal-dark-bg.svg` | Navbar and headers, dark backgrounds |
| `lumora-app-icon-cream.png` | App icon, favicon source, PWA icon |
| `lumora-app-icon-green.png` | Alternate app icon on dark |
| `lumora-logo-motion-*.mp4 / .gif` | Splash, demo video, loading moments |

### Rules

- Navbar: use `lumora-lockup-horizontal.svg` at 28px height on desktop, 24px on mobile.
- Favicon and PWA icons: generate from `lumora-app-icon-cream.png` (16, 32, 180, 192, 512).
- Minimum size: mark 20px tall; horizontal lockup 20px tall.
- Clear space: at least the height of the bottom ledger line's gap (about a quarter of the mark's height) on all sides.
- Never recolour, stretch, rotate, outline, add shadows to, or place the logo on a busy photo.
- The amber in the logo is always Harvest amber. The lines are Lumora green on light backgrounds and Sage on dark.
- The wordmark is always lowercase: **lumora**. In running text, write "Lumora".

---

## 3. Colour

### Palette

| Token | Hex | Role |
|---|---|---|
| `green` (primary) | `#1F5C45` | Buttons, links, active tabs, focus rings, selected states |
| `green-hover` | `#184A37` | Hover and pressed state for primary |
| `field` | `#0E2E23` | Dark surfaces: marketing hero, footer, dark mode background |
| `sage` | `#8FB8A4` | Secondary fills, chart series, lines on dark surfaces |
| `sage-soft` | `#E8EFEB` | Secondary buttons, subtle fills, selected rows |
| `amber` (accent) | `#C08A2E` | Highest bid, key number, the single most important highlight on screen |
| `amber-soft` | `#F5EBD7` | Background behind an amber highlight |
| `paper` | `#F6F3EC` | App and page background |
| `surface` | `#FFFFFF` | Cards, inputs, tables |
| `ink` | `#14201B` | Primary text |
| `ink-muted` | `#6B7B73` | Secondary text, labels, captions |
| `line` | `#DCE3DF` | Borders, dividers, table rules |
| `danger` | `#B4442F` | Errors, destructive actions, declined units |
| `success` | `#2E7D6B` | Paid, settled. Use with an icon or text, never colour alone |

### Rules

- **Amber is rare.** Use it for at most one or two elements per screen: the highest bid on the board, the payout total, the main CTA on the landing page. Never for general buttons, borders or backgrounds.
- **Green is the workhorse.** Every primary action is green with paper-coloured text.
- **Never put white text on amber.** It fails contrast (3.0:1). If text sits on amber, use `ink`.
- **Success is not the primary green.** Use `success` with a check icon so "Paid" does not look like a button.
- Body text is always `ink` on `paper` or `surface`. Muted text is `ink-muted`, never lighter.

### Contrast (checked)

| Pair | Ratio |
|---|---|
| Paper text on `green` | 7.1:1 |
| White text on `green` | 7.9:1 |
| Paper text on `field` | 13.2:1 |
| `ink` on `amber` | 5.5:1 |
| `ink` on `paper` | 15.2:1 |

---

## 4. Typography

### Fonts

| Role | Font | Weights | Where |
|---|---|---|---|
| **Primary (UI and body)** | **DM Sans** | 400, 500, 600 | Everything in the app: navigation, forms, tables, buttons, body copy |
| Display | Fraunces | 500 | Marketing headlines, page titles on the landing page, empty-state headlines |
| Numbers | Geist Mono | 400, 500 | Prices, quantities, weights, booking codes, capacity counts |

DM Sans is the primary font. Fraunces is for display moments only, never for UI labels, buttons or tables. Every price, weight and quantity uses Geist Mono with tabular figures so columns line up like a market board.

### Loading (Next.js)

```tsx
// app/layout.tsx
import { Fraunces, DM_Sans, Geist_Mono } from "next/font/google";

const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const display = Fraunces({ subsets: ["latin"], weight: ["500"], variable: "--font-display" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="bg-paper font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
```

### Type scale

| Token | Size / line height | Font | Use |
|---|---|---|---|
| `display-xl` | 56 / 60, tracking -0.02em | Fraunces 500 | Landing hero headline |
| `display-lg` | 40 / 46, tracking -0.015em | Fraunces 500 | Landing section headlines |
| `title` | 24 / 32, tracking -0.01em | DM Sans 600 | App page titles |
| `heading` | 18 / 26 | DM Sans 600 | Card and section headings |
| `body` | 15 / 24 | DM Sans 400 | Default text |
| `body-sm` | 13 / 20 | DM Sans 400 | Secondary text, table cells |
| `label` | 12 / 16, tracking 0.02em | DM Sans 500 | Form labels, column headers |
| `number-lg` | 32 / 36 | Geist Mono 500 | Payout totals, headline prices |
| `number` | 15 / 24 | Geist Mono 400 | Prices and quantities in tables and cards |

- On mobile, `display-xl` drops to 36/42 and `display-lg` to 28/34.
- Sentence case everywhere. No all-caps headings. Column headers may be small sentence-case labels.
- Prices are written `₦3,500/kg`, `₦28,000/basket`, `₦5,600/crate`. Always the Naira sign, a thousands separator and the unit.

---

## 5. Theme tokens

### Tailwind v4 and shadcn/ui

Paste into `app/globals.css`. These values replace the shadcn defaults.

```css
@import "tailwindcss";

:root {
  --radius: 0.5rem;

  --background: #F6F3EC;
  --foreground: #14201B;
  --card: #FFFFFF;
  --card-foreground: #14201B;
  --popover: #FFFFFF;
  --popover-foreground: #14201B;

  --primary: #1F5C45;
  --primary-foreground: #F6F3EC;
  --secondary: #E8EFEB;
  --secondary-foreground: #14201B;
  --muted: #EEF2EF;
  --muted-foreground: #6B7B73;
  --accent: #E8EFEB;
  --accent-foreground: #14201B;
  --destructive: #B4442F;
  --border: #DCE3DF;
  --input: #DCE3DF;
  --ring: #1F5C45;

  --chart-1: #1F5C45;
  --chart-2: #8FB8A4;
  --chart-3: #C08A2E;
  --chart-4: #0E2E23;
  --chart-5: #6B7B73;
}

.dark {
  --background: #0E2E23;
  --foreground: #F6F3EC;
  --card: #133A2D;
  --card-foreground: #F6F3EC;
  --popover: #133A2D;
  --popover-foreground: #F6F3EC;
  --primary: #8FB8A4;
  --primary-foreground: #0E2E23;
  --secondary: #1A4636;
  --secondary-foreground: #F6F3EC;
  --muted: #1A4636;
  --muted-foreground: #A9BDB3;
  --accent: #1A4636;
  --accent-foreground: #F6F3EC;
  --destructive: #D8644E;
  --border: #24503F;
  --input: #24503F;
  --ring: #8FB8A4;
}

@theme inline {
  --font-sans: var(--font-sans);
  --font-display: var(--font-display);
  --font-mono: var(--font-mono);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-green: #1F5C45;
  --color-green-hover: #184A37;
  --color-field: #0E2E23;
  --color-sage: #8FB8A4;
  --color-sage-soft: #E8EFEB;
  --color-amber: #C08A2E;
  --color-amber-soft: #F5EBD7;
  --color-paper: #F6F3EC;
  --color-ink: #14201B;
  --color-ink-muted: #6B7B73;
  --color-line: #DCE3DF;
  --color-success: #2E7D6B;

  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
}

.font-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

Light mode is the default for the app. Dark mode is optional for the hackathon; the marketing site uses `field` sections inside the light theme rather than a full dark mode.

---

## 6. Layout and spacing

- Spacing scale: Tailwind defaults on a 4px base. Common values: 8, 12, 16, 24, 32, 48, 64.
- App content max width: 1200px. Marketing content max width: 1120px. Reading width for long text: 680px.
- Page padding: 16px on mobile, 24px on tablet, 32px on desktop.
- Cards: `surface` background, 1px `line` border, radius 12px, padding 16px (mobile) or 20px (desktop). No shadows by default; a very soft shadow is allowed only on popovers and dialogs.
- Radius: 8px for buttons and inputs, 12px for cards, 16px for large marketing panels. No pill shapes except for small segmented toggles.
- Borders are 1px `line`. Dividers inside cards are 1px `line`.
- Design mobile first. Producers use phones; buyers mostly use laptops. Both must work at 360px wide.

---

## 7. Components

### Buttons

| Variant | Style | Use |
|---|---|---|
| Primary | `green` background, `paper` text; hover `green-hover` | Main action per view: Book slot, Post demand, Confirm delivery |
| Secondary | `sage-soft` background, `ink` text | Secondary actions: Edit, Filter |
| Ghost | Transparent, `ink` text, `sage-soft` on hover | Tertiary actions, table row actions |
| Destructive | `danger` background, white text | Cancel booking, Decline units |
| Highlight (marketing only) | `amber` background, `ink` text | One hero CTA on the landing page |

Height 40px (desktop) and 44px (mobile, for touch). Label in DM Sans 500, 14–15px, sentence case. One primary button per view.

### The bid row (signature component)

The board is the product. Each buyer listing is a row, styled like a market board:

```
Caterer D · Angwan Rukuba           ₦3,800/kg     40 left · Thu
Live broilers, 2.5–3.5 kg                          [ Book ]
```

- Buyer name in DM Sans 500, location in `ink-muted`.
- Price in `font-num` 500. The **highest bid on the board** gets `amber` text and an `amber-soft` background on the price cell only.
- Capacity in `font-num` with a thin capacity bar under the row: track `sage-soft`, fill `green`, 4px tall, square ends.
- When full, the row shows "Full" in `ink-muted` and the Book button is disabled.

### Capacity bar

- 4px tall, radius 2px, track `sage-soft`, fill `green`.
- Animate width changes over 400ms with ease-out when capacity updates in real time.
- Never colour it red or amber to show urgency. The number does that job.

### Status

Show status as **plain text with an icon**, never as coloured dot pills.

| Status | Display |
|---|---|
| Booked | Clock icon + "Booked" in `ink` |
| Delivered | Truck icon + "Delivered" in `ink` |
| Settled / Paid | Check icon + "Paid" in `success` |
| Disputed | Alert icon + "Disputed" in `amber` |
| Cancelled / No-show | X icon + label in `ink-muted` |

### Tables

- Header row: `label` style, `ink-muted`, bottom border `line`.
- Rows 48px tall, 1px `line` between rows, no zebra striping.
- Numeric columns right-aligned in `font-num`.

### Forms

- Inputs 40px tall (44px on mobile), `surface` background, 1px `line` border, radius 8px, focus ring 2px `green` offset 2px.
- Labels above inputs in `label` style. Helper text in `body-sm` `ink-muted`. Errors in `body-sm` `danger` with an icon.
- Price inputs show the ₦ prefix and the unit suffix inside the field: `₦ [ 3,500 ] /kg`.

### Charts

- Use Recharts. Series colours in order: `green`, `sage`, `amber`, `field`.
- Thin 1px gridlines in `line`, no chart borders, no 3D, no gradients.
- Axis labels in `body-sm` `ink-muted`. Values in `font-num`.

### Icons

- Lucide icons (bundled with shadcn), 1.5px stroke, 16px inline, 20px in buttons and navigation.
- Outline icons only.

---

## 8. Motion

- Default transition: 200ms, ease-out. Panels and dialogs: 250ms.
- Capacity bar and live counters: 400ms ease-out when values change.
- New bids arriving on the board slide in from 8px below and fade in over 250ms.
- Logo motion files are for the splash screen, demo video and the landing page hero only.
- Respect `prefers-reduced-motion`: disable slides and keep only opacity changes.

---

## 9. Imagery

- Use real photos from Jos and Plateau markets: crates, weigh scales, birds in transit, tomato baskets, buyers' kitchens. The team should shoot these.
- Photos are slightly desaturated and warm. Never place text directly on a busy photo; use a `field` panel beside or over it.
- No stock photos of wheat fields, tractors, or smiling farmers holding baskets at the camera.
- No food or meal imagery (plates, cooked dishes). Lumora is about raw produce, not food delivery.
- Illustrations, when needed, use the logo's geometry: horizontal ledger lines, the kernel shape, flat fills in brand colours.

---

## 10. Voice and copy

- **Plain and numeric.** "₦3,800/kg. 40 left. Thursday." Numbers do the persuading.
- **Local and specific.** Name real places: Bukuru, Rayfield, Farin Gada, Angwan Rukuba.
- **Produce, not food.** Say live broilers, tomatoes, crates, baskets, per kg. Never "food", "meals" or "order food".
- **Calm, never hype.** No "revolutionising agriculture", no "AI-powered", no exclamation marks in the UI.
- **Short buttons.** Book slot, Post demand, Confirm delivery, Mark as paid.
- **Helpful empty states.** "No buyers for tomatoes near Jos yet. Follow tomatoes and we'll text you when one posts."

### Core copy

| Place | Copy |
|---|---|
| Hero headline | Buyers are waiting. What are you selling? |
| Hero subline | Buyers post what they need and what they'll pay. Farmers book it before they load the truck. |
| Buyer CTA | Post your demand |
| Producer CTA | See buyers near you |
| Positioning line | A marketplace is a shop window for sellers. Lumora is a notice board for buyers of farm produce. |

---

## 11. Do not

- No emojis anywhere: UI, marketing, notifications.
- No green-dot or coloured-dot status pills. Use icon and text.
- No gradients, glassmorphism, glows, blobs or neon.
- No drop shadows on cards.
- No more than two amber elements on a screen.
- No white text on amber.
- No Fraunces in buttons, forms or tables.
- No all-caps headings.
- No placeholder lorem ipsum in demos. Use realistic Jos data: broilers ₦3,300–3,800/kg, tomatoes by basket, eggs by crate.

---

## 12. Setup checklist for the agent

1. Create the Next.js app (TypeScript, Tailwind v4, App Router) with pnpm.
2. Initialise shadcn/ui and add only: button, card, input, label, select, dialog, sheet, table, tabs, form, sonner, separator, skeleton.
3. Replace `app/globals.css` with the tokens in section 5.
4. Load fonts as in section 4 and set `bg-paper font-sans text-ink` on `body`.
5. Copy the logo pack into `public/brand/` and generate favicons and PWA icons from `lumora-app-icon-cream.png`.
6. Build a `/brand` page that renders the palette, type scale, buttons, a bid row, a capacity bar and status labels, so the team can check the system before building screens.
7. Add a `formatNaira(amount, unit?)` helper that returns strings like `₦3,500/kg`, and use it for every price.