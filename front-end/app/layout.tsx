import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Geist_Mono } from "next/font/google";

import { MomentHost } from "@/components/loader/moment-host";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-display",
});

// Geist Mono has no Naira sign. A monospace fallback keeps it one cell wide,
// so prices still line up in columns.
const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "Menlo", "Consolas", "monospace"],
});

const SHARE_TITLE = `${SITE_NAME} | ${SITE_TAGLINE}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Find farm produce buyers in Jos and Plateau State`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "agriculture",
  keywords: [
    "farm produce buyers Jos",
    "live broiler prices Jos",
    "tomato buyers Plateau State",
    "poultry buyers Nigeria",
    "agricultural demand board",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SHARE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#F6F3EC",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      suppressHydrationWarning
      lang="en-NG"
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before paint, so a tab that has already had the first-load sequence never flashes it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("lumora.loader.seen")==="1")document.documentElement.dataset.lumoraSeen="1"}catch(e){}`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="flex min-h-full flex-col bg-paper font-sans text-body text-ink">
        {children}
        <MomentHost />
      </body>
    </html>
  );
}
