"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 64; // px of pull needed to trigger refresh

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pullY, setPullY] = useState(0);
  const startYRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only activate pull gesture when already at the top
    if ((scrollRef.current?.scrollTop ?? 0) <= 0) {
      startYRef.current = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      // Apply rubber-band resistance so it doesn't pull 1:1
      setPullY(Math.min(delta * 0.45, THRESHOLD + 16));
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pullY >= THRESHOLD * 0.75) {
      startTransition(() => router.refresh());
    }
    setPullY(0);
    startYRef.current = null;
  }, [pullY, router]);

  const progress = Math.min(pullY / (THRESHOLD * 0.75), 1);
  const isVisible = pullY > 4 || isPending;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto pb-20 relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center z-30 pointer-events-none"
        style={{
          top: isVisible ? Math.max(pullY * 0.55, isPending ? 10 : 0) : -48,
          opacity: isVisible ? Math.max(progress, isPending ? 1 : 0) : 0,
          transition: pullY === 0 ? "top 0.2s, opacity 0.2s" : "none",
        }}
      >
        <div
          className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center"
          style={{
            transform: isPending ? undefined : `rotate(${progress * 270}deg)`,
            animation: isPending ? "spin 0.7s linear infinite" : undefined,
          }}
        >
          <svg
            className="w-4 h-4 text-orange-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
      </div>

      {children}
    </div>
  );
}
