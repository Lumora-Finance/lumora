import { ClosingCta } from "@/components/landing/closing-cta";
import { ChaosToOrder } from "@/components/landing/chaos-to-order";
import { Hero } from "@/components/landing/hero";
import { DemandExplorer } from "@/components/landing/demand-explorer";
import { HeroStory } from "@/components/landing/hero-story";
import { HowItWorks } from "@/components/landing/how-it-works";
import { OnePost } from "@/components/landing/one-post";
import { SiteFooter } from "@/components/landing/site-footer";
import { Ticker } from "@/components/landing/ticker";
import { PageMotion } from "@/components/motion/page-motion";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512.png`,
      description: SITE_DESCRIPTION,
      areaServed: { "@type": "AdministrativeArea", name: "Plateau State, Nigeria" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: "en-NG",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c"),
        }}
      />
      <main id="top" className="flex-1">
        <Hero />
        <HeroStory />
        <Ticker />
        <ChaosToOrder />
        <HowItWorks />
        <OnePost />
        <DemandExplorer />
        <ClosingCta />
      </main>
      <SiteFooter />
      <PageMotion />
    </>
  );
}
