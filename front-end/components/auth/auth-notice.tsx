"use client";

import { useSearchParams } from "next/navigation";

const DEFAULT_SUBLINE = "See every buyer near you, or post what you need.";

const SUBLINES: Record<string, string> = {
  buyer: "Post your demand and reach farmers near you.",
  producer: "See who's buying near you before you load the truck.",
};

export function SignupSubline() {
  const role = useSearchParams().get("role");
  return <>{(role && SUBLINES[role]) ?? DEFAULT_SUBLINE}</>;
}

export { DEFAULT_SUBLINE };
