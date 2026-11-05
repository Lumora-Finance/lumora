import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
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
