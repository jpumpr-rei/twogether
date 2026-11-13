// Geometry of the twogether mark: two overlapping circles whose overlap (the "lens") is the
// shared colour. Pure and framework-free so the nav, the wordmark, the pull-to-refresh
// indicator and (later) the toy can all share it, and so it can be unit-tested.

/** The mark is drawn in a 48 by 32 box. */
export const MARK_VIEWBOX = { width: 48, height: 32 } as const;
export const MARK_RADIUS = 12;

const CX = 24;
const CY = 16;

export type MarkState = "step" | "syncing" | "needs" | "off";

/** Distance between the two circle centres for each state, in viewBox units. */
export const MARK_DISTANCE: Record<MarkState, number> = {
  step: 12, // large lens: everything is in step
  syncing: 12, // same shape; the component spins it
  needs: 24, // the circles just touch: no lens
  off: 28, // a gap: access ended
};

const n = (v: number) => v.toFixed(3);

/**
 * Where to draw the circles and the lens for a given distance between centres.
 * The lens is bounded on the left by the right-hand circle's left arc and on the right by
 * the left-hand circle's right arc, meeting at the top and bottom intersection points.
 */
export function markGeometry(distance: number) {
  const d = Math.max(0, distance);
  const half = d / 2;
  const h = half < MARK_RADIUS ? Math.sqrt(MARK_RADIUS ** 2 - half ** 2) : 0;
  const lens =
    h > 0.001
      ? `M ${CX} ${n(CY - h)} A ${MARK_RADIUS} ${MARK_RADIUS} 0 0 0 ${CX} ${n(CY + h)} A ${MARK_RADIUS} ${MARK_RADIUS} 0 0 0 ${CX} ${n(CY - h)} Z`
      : "";
  return {
    ax: CX - half,
    bx: CX + half,
    cy: CY,
    r: MARK_RADIUS,
    lens,
    lensWidth: Math.max(0, 2 * MARK_RADIUS - d),
    lensHeight: 2 * h,
  };
}
