import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  experimental: {
    // Cache pages client-side for 60s so switching tabs feels instant.
    // Pull-to-refresh or browser refresh forces a new server fetch.
    staleTimes: {
      dynamic: 60,
    },
  },
};

export default nextConfig;
