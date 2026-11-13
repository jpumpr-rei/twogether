"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BRAND } from "@/lib/brand/palette";
import {
  MARK_DISTANCE,
  MARK_VIEWBOX,
  markGeometry,
  type MarkState,
} from "@/lib/brand/markGeometry";

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED).matches,
    () => false
  );
}

// A slightly underdamped spring: the circles overshoot a little and "click" together.
const STIFFNESS = 170;
const DAMPING = 14;

function useSpring(target: number, from: number, animate: boolean) {
  const [value, setValue] = useState(from);
  const current = useRef(from);
  const velocity = useRef(0);

  useEffect(() => {
    if (!animate) {
      current.current = target;
      velocity.current = 0;
      return;
    }
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      velocity.current += (-STIFFNESS * (current.current - target) - DAMPING * velocity.current) * dt;
      current.current += velocity.current * dt;
      if (Math.abs(current.current - target) < 0.01 && Math.abs(velocity.current) < 0.01) {
        current.current = target;
        setValue(target);
        return;
      }
      setValue(current.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);

  return animate ? value : target;
}

type Props = {
  /** Which state to show. The circles glide between states with a small overshoot. */
  state?: MarkState;
  /** Overrides the state with an exact distance between centres (viewBox units), with no animation. */
  distance?: number;
  /** Start with the circles apart and click them together on first render. */
  intro?: boolean;
  /** Pixels, or any CSS length such as "1.15em". Height follows the 3:2 shape. */
  width?: number | string;
  /** The two circles and the overlap. Defaults to the brand colours. */
  colors?: readonly [string, string, string];
  className?: string;
  /** Gives the mark an accessible name; without it the mark is decorative. */
  title?: string;
};

export default function Mark({
  state = "step",
  distance,
  intro = false,
  width = 48,
  colors,
  className,
  title,
}: Props) {
  const reduced = usePrefersReducedMotion();
  const target = distance ?? MARK_DISTANCE[state];
  const shown = useSpring(
    target,
    intro ? MARK_DISTANCE.needs : target,
    distance === undefined && !reduced
  );
  const g = markGeometry(shown);
  const [a, b, shared] = colors ?? [BRAND.you, BRAND.them, BRAND.us];
  const height = typeof width === "number" ? (width * MARK_VIEWBOX.height) / MARK_VIEWBOX.width : undefined;
  const spinning = state === "syncing" && distance === undefined;

  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`}
      width={width}
      height={height}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ overflow: "visible", flex: "none" }}
    >
      {title ? <title>{title}</title> : null}
      <g className={spinning ? "mark-orbit" : undefined}>
        <circle cx={g.ax} cy={g.cy} r={g.r} fill={a} />
        <circle cx={g.bx} cy={g.cy} r={g.r} fill={b} opacity={state === "off" ? 0.35 : 1} />
        {g.lens ? <path d={g.lens} fill={shared} opacity={state === "off" ? 0.35 : 1} /> : null}
      </g>
    </svg>
  );
}
