import { mosaicFills, trianglePoints, TRIANGLE_COUNT } from "@/lib/brand/palette";

/**
 * The loud full-colour mosaic. Held behind the login screens; text never sits directly on it,
 * only on cards. Fixed behind the page, which sits above it (z-10).
 */
export default function Mosaic() {
  const fills = mosaicFills();
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
            points={trianglePoints(i)}
            fill={fills[i]}
            stroke={fills[i]}
            strokeWidth={0.3}
          />
        ))}
      </svg>
    </div>
  );
}
