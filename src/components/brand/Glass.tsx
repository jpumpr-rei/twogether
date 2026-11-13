import { glassFills, trianglePoints, TRIANGLE_COUNT, type Ramp } from "@/lib/brand/palette";

/**
 * The resting background: faceted near-black glass with one softly lit cluster in the lens
 * colour. Fixed behind the page; the page content sits above it (z-10). Changing `ramp`
 * re-colours the lit cluster with a short transition.
 */
export default function Glass({ ramp }: { ramp: Ramp }) {
  const fills = glassFills(ramp);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-ink">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {Array.from({ length: TRIANGLE_COUNT }, (_, i) => (
          <polygon
            key={i}
            className="glass-poly"
            points={trianglePoints(i)}
            style={{ fill: fills[i] }}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}
