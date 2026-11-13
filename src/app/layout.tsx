import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ui/ServiceWorkerRegistration";

// Display type for headlines and numbers; UI type for everything else. Both are variable fonts,
// and globals.css maps these variables onto Tailwind's font-display and font-sans.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  axes: ["opsz"],
});
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

// iOS shows a plain black screen while a home-screen web app starts unless it is given
// launch images. Files are in public/splash (regenerate with scripts/generate-brand-assets.mjs);
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
    // A black status bar sits well on the dark Home screen and is fine over the light ones.
    statusBarStyle: "black",
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

// Pinch-zoom is allowed (locking it fails WCAG 1.4.4). The old lock also stopped iOS zooming
// into small fields on focus; globals.css pins fields to 16px for that instead.
export const viewport: Viewport = {
  themeColor: "#0E0E10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
      </head>
      <body className="bg-white text-gray-900 font-sans antialiased">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
