import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ui/ServiceWorkerRegistration";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// iOS shows a plain black screen while a home-screen web app starts unless it is given
// launch images. Files are in public/splash (regenerate with scripts/generate-splash.sh);
// each entry targets one iPhone screen size.
const splash = (w: number, h: number, ratio: number) => ({
  url: `/splash/splash-${w * ratio}x${h * ratio}.png`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
});

export const metadata: Metadata = {
  title: "twogether",
  description: "Shared budgets for couples",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "twogether",
    startupImage: [
      splash(440, 956, 3),
      splash(420, 912, 3),
      splash(402, 874, 3),
      splash(430, 932, 3),
      splash(393, 852, 3),
      splash(428, 926, 3),
      splash(390, 844, 3),
      splash(375, 812, 3),
      splash(414, 896, 3),
      splash(414, 896, 2),
      splash(414, 736, 3),
      splash(375, 667, 2),
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-white text-gray-900 font-sans antialiased">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
