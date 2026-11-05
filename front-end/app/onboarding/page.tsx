import type { Metadata } from "next";

import { OnboardingFlow } from "@/components/location/onboarding-flow";

export const metadata: Metadata = { title: "Get started", robots: { index: false, follow: false } };

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
