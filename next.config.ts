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
  // Handled before Proxy runs, so opening the app doesn't pay for a proxy pass
  // (and a second one after a page-level redirect) just to land on /budgets.
  async redirects() {
    return [{ source: "/", destination: "/budgets", permanent: false }];
  },
  async headers() {
    return [
      {
        // Always revalidate the service worker script so updates ship immediately.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
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
