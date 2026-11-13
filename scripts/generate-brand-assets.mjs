// Renders the app icon and the iOS launch ("splash") images from the real mark geometry:
// the two-circle mark, centred on the near-black canvas.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generate-brand-assets.mjs
//
// Needs `sharp` (it ships with Next). Keep the launch-image list in sync with `startupImage`
// in src/app/layout.tsx. iOS only picks up a new icon or launch images when the app is removed
// from the home screen and added again.
import sharp from "sharp";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { markGeometry, MARK_DISTANCE } from "../src/lib/brand/markGeometry.ts";
import { BRAND, INK } from "../src/lib/brand/palette.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const g = markGeometry(MARK_DISTANCE.step);

// The mark is 36 units wide (two 24-unit circles 12 apart) by 24 tall, centred on (24, 16).
const MARK_UNITS_WIDE = 36;
const mark =
  `<circle cx="${g.ax}" cy="${g.cy}" r="${g.r}" fill="${BRAND.you}"/>` +
  `<circle cx="${g.bx}" cy="${g.cy}" r="${g.r}" fill="${BRAND.them}"/>` +
  `<path d="${g.lens}" fill="${BRAND.us}"/>`;

function scene(w, h, markShare) {
  const scale = (w * markShare) / MARK_UNITS_WIDE;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${INK}"/>` +
    `<g transform="translate(${w / 2} ${h / 2}) scale(${scale}) translate(-24 -16)">${mark}</g>` +
    `</svg>`
  );
}

async function write(path, w, h, markShare) {
  await sharp(Buffer.from(scene(w, h, markShare))).png({ compressionLevel: 9 }).toFile(path);
  console.log(path.replace(root + "/", ""), `${w}x${h}`);
}

// App icon. The mark stays inside the central safe zone so the icon survives being masked.
const icons = join(root, "public/icons");
mkdirSync(icons, { recursive: true });
await write(join(icons, "icon-512.png"), 512, 512, 0.56);
await write(join(icons, "icon-192.png"), 192, 192, 0.56);

// Launch images: physical pixels per iPhone screen (CSS size times pixel ratio).
const splash = join(root, "public/splash");
mkdirSync(splash, { recursive: true });
for (const f of readdirSync(splash)) if (f.startsWith("splash-")) rmSync(join(splash, f));
const SIZES = [
  [1320, 2868], // 440 x 956 @3
  [1260, 2736], // 420 x 912 @3
  [1206, 2622], // 402 x 874 @3
  [1290, 2796], // 430 x 932 @3
  [1179, 2556], // 393 x 852 @3
  [1284, 2778], // 428 x 926 @3
  [1170, 2532], // 390 x 844 @3
  [1125, 2436], // 375 x 812 @3
  [1242, 2688], // 414 x 896 @3
  [828, 1792], //  414 x 896 @2
  [1242, 2208], // 414 x 736 @3
  [750, 1334], //  375 x 667 @2
];
for (const [w, h] of SIZES) await write(join(splash, `splash-${w}x${h}.png`), w, h, 0.3);
