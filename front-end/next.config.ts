import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  turbopack: {
    // Pin the root to this package so Turbopack never walks up to a stray
    // lockfile at the repo root and resolves plugins from the wrong directory.
    root: __dirname,
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      {
        // Google profile photos (sign in with Google)
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        // GitHub avatars
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },

};

export default nextConfig;
