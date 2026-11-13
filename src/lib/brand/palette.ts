// Colour and shape data for the Bold Duo look (see docs/specs/brand/BRAND_DIRECTION.md on the
// spec branch). One self-contained module so it can be used by components and unit-tested.

export const INK = "#0E0E10";

export const BRAND = {
  you: "#F4512C", // persimmon
  them: "#4057FF", // ultramarine
  us: "#7C46E6", // the overlap
  sun: "#FFD60A",
  lime: "#B9E32B",
} as const;

// ── Hues ────────────────────────────────────────────────────────────────────────────────────────
// Each person has a hue. Colours belong to people, not to the viewer, so both partners see the
// same colour for the same person. Until people can choose their own, the household's two
// members get the defaults in a stable order.

export type HueKey = "persimmon" | "ultramarine";
export type RampName = "you" | "them" | "us";

export const HUES: Record<HueKey, { fill: string; onDark: string; ramp: RampName }> = {
  persimmon: { fill: BRAND.you, onDark: BRAND.you, ramp: "you" },
  // #4057FF is only 3.5:1 on the black cards, so text and thin strokes on black use a lighter tone.
  ultramarine: { fill: BRAND.them, onDark: "#7C8CFF", ramp: "them" },
};

export const SHARED_HUE = { fill: BRAND.us, onDark: "#A683FF", ramp: "us" as RampName };

/** The earlier account gets persimmon, the other ultramarine. Stable whatever order they arrive in. */
export function assignHues(members: { id: string; createdAt: string }[]): Record<string, HueKey> {
  const sorted = [...members].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
  const out: Record<string, HueKey> = {};
  sorted.forEach((m, i) => {
    out[m.id] = i === 0 ? "persimmon" : "ultramarine";
  });
  return out;
}

// ── Spotlight glass ─────────────────────────────────────────────────────────────────────────────
// The resting background: faceted near-black glass with one softly lit cluster in the lens
// colour. Five flat steps mix the colour into ink at 60, 40, 28, 18 and 10 percent.

export type Ramp = readonly [string, string, string, string, string];

export const RAMPS: Record<RampName, Ramp> = {
  us: ["#503090", "#3A2466", "#2D1E4C", "#221837", "#191425"],
  you: ["#983621", "#6A291B", "#4E2118", "#371A15", "#251513"],
  them: ["#2C3A9F", "#222B70", "#1C2253", "#171B3B", "#131528"],
};

/** Four near-black steps, 1.04 to 1.16 apart in contrast against ink. */
export const GLASS_TONES: Record<string, string> = {
  K: INK,
  A: "#131317",
  C: "#18181D",
  D: "#1E1E24",
};

// A fixed tessellation of 22 flat triangles over a 100 by 100 box.
const POINTS: [number, number][] = [
  [0, 0], [46, 0], [100, 0], [100, 30], [100, 64], [100, 100], [52, 100], [0, 100], [0, 72],
  [0, 38], [30, 22], [66, 16], [80, 48], [22, 56], [55, 60], [40, 82], [78, 84],
];
const TRIANGLES: [number, number, number][] = [
  [0, 1, 10], [0, 10, 9], [1, 2, 11], [1, 11, 10], [2, 3, 11], [3, 12, 11], [3, 4, 12],
  [10, 11, 12], [10, 12, 14], [10, 14, 13], [9, 10, 13], [9, 13, 8], [8, 13, 15], [13, 14, 15],
  [14, 12, 16], [12, 4, 16], [14, 16, 15], [4, 5, 16], [16, 5, 6], [15, 16, 6], [15, 6, 7],
  [8, 15, 7],
];

export const TRIANGLE_COUNT = TRIANGLES.length;

export function trianglePoints(i: number): string {
  return TRIANGLES[i].map((k) => POINTS[k].join(",")).join(" ");
}

// One character per triangle. Digits 1 to 5 are the lit ramp (1 brightest); letters are glass tones.
export const GLASS_LAYOUT = "2A315CK4CAKDAKCADKACKA";

export function glassFills(ramp: Ramp): string[] {
  return [...GLASS_LAYOUT].map((ch) => {
    const step = Number(ch);
    return step >= 1 && step <= 5 ? ramp[step - 1] : GLASS_TONES[ch];
  });
}

// ── Full mosaic ─────────────────────────────────────────────────────────────────────────────────
// The loud version: held on the login screens and (later) bursting in behind a win.

export const MOSAIC_COLORS: Record<string, string> = {
  R: BRAND.you,
  B: BRAND.them,
  V: BRAND.us,
  Y: BRAND.sun,
  L: BRAND.lime,
  K: INK,
};
export const MOSAIC_LAYOUT = "RRKYKLLYYRRBRYLLKYKRKV";

export function mosaicFills(): string[] {
  return [...MOSAIC_LAYOUT].map((ch) => MOSAIC_COLORS[ch]);
}
