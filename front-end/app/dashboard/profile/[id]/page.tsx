"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin, Store } from "lucide-react";
import Link from "next/link";


import { DetailSkeleton } from "@/components/loader/skeletons";
import { Reveal } from "@/components/motion/reveal";
import { ProfileCard, SaveProfileButton } from "@/components/profile/profile-card";
import { getToken } from "@/lib/firebase/auth";
import { trackTask } from "@/lib/loading/progress";
import { cn } from "@/lib/utils";

type Profile = {
  id: string;
  name: string;
  role: string;
  area: string | null;
  bio: string | null;
  photo_url: string | null;
  verified: boolean;
  created_at: string;
  listing_count: number;
  booking_count: number;
  listings: Array<{
    id: string;
    spec: string | null;
    unit_price_kobo: number;
    capacity_per_day: number;
    status: string;
    created_at: string;
    commodity: { name: string; unit: string };
    area: string | null;
  }>;
};

function formatKobo(kobo: number, unit: string) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}/${unit}`;
}

function relDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const finished = trackTask("public-profile");
      setError(null);
      try {
        const token = await getToken();
        const res = await fetch(`/api/users/${userId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as Profile;
        if (!cancelled) setProfile(data);
      } catch {
        if (!cancelled) setError("Couldn't load this profile.");
      } finally {
        finished();
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return <DetailSkeleton label="Opening this profile" />;
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="font-display text-title font-medium text-ink">{error ?? "Profile not found"}</p>
        <Link href="/dashboard/marketplace" className="rounded-lg bg-green px-5 py-2.5 text-body-sm font-medium text-paper">
          Back to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 lg:px-8">

      <ProfileCard
        name={profile.name}
        lead={profile.bio || `${profile.role === "buyer" ? "Buying" : "Selling"} produce on Lumora`}
        role={profile.role}
        area={profile.area}
        joined={relDate(profile.created_at)}
        photoUrl={profile.photo_url}
        verified={profile.verified}
        deliveries={profile.booking_count}
        posts={profile.listing_count}
        produce={(profile.listings ?? []).map((listing) => listing.commodity.name)}
        corner={<SaveProfileButton id={profile.id} />}
        action={{ label: "Get in touch", href: `/dashboard/messages?to=${encodeURIComponent(profile.name)}` }}
      />

      {/* Listings */}
      {profile.listings && profile.listings.length > 0 && (
        <Reveal effect="riseIn" className="mt-8">
          <h2 className="flex items-center gap-2 text-heading font-medium text-ink">
            <Store strokeWidth={1.5} className="size-5 text-green" />
            {profile.role === "buyer" ? "Demand Listings" : "Activity"}
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.listings.map((listing) => (
              <Link key={listing.id} href={`/dashboard/marketplace/${listing.id}`}
                className="group flex flex-col overflow-hidden rounded-[20px] border border-line bg-white transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-green">
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={cn("rounded-md px-2 py-0.5 font-num text-label font-medium",
                        listing.status === "active" ? "bg-sage-soft text-green" : "bg-amber-soft text-amber")}>
                        {listing.status.toUpperCase()}
                      </span>
                      <p className="mt-1.5 font-medium text-ink">{listing.commodity.name}</p>
                      {listing.spec && <p className="mt-0.5 line-clamp-2 text-body-sm text-ink-muted">{listing.spec}</p>}
                    </div>
                    <p className="shrink-0 font-num text-body-sm font-medium text-amber">
                      {formatKobo(listing.unit_price_kobo, listing.commodity.unit)}
                    </p>
                  </div>
                  <div className="mt-2 text-body-sm text-ink-muted">
                    {listing.area && <p className="flex items-center gap-1"><MapPin strokeWidth={1.5} className="size-3.5" />{listing.area}</p>}
                    <p className="font-num">{listing.capacity_per_day} {listing.commodity.unit}s/day</p>
                  </div>
                </div>
                <div className="border-t border-line px-4 py-2.5">
                  <span className="text-body-sm font-medium text-green group-hover:underline">View listing →</span>
                </div>
              </Link>
            ))}
          </div>
        </Reveal>
      )}

      {(!profile.listings || profile.listings.length === 0) && (
        <div className="mt-8 rounded-[20px] bg-paper px-6 py-10 text-center text-ink-muted border border-line">
          <p className="text-body">No listings posted yet.</p>
        </div>
      )}
    </div>
  );
}
