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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com https://www.google.com https://www.gstatic.com https://js.stripe.com",
              "frame-src 'self' https://cdn.plaid.com https://www.google.com https://recaptcha.google.com",
              "connect-src 'self' https://*.plaid.com https://*.supabase.co wss://*.supabase.co https://www.google.com",
              "img-src 'self' data: blob: https:",
              "style-src 'self' 'unsafe-inline' https://cdn.plaid.com",
              "font-src 'self' data: https://cdn.plaid.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
