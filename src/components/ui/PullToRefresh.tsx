"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Mark from "@/components/brand/Mark";

const THRESHOLD = 64; // px of pull needed to trigger refresh

// On these pages, pull-to-refresh also triggers a Plaid sync first.
const SYNC_PATHS = ["/transactions", "/accounts"];

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [pullY, setPullY] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const shouldSync = SYNC_PATHS.some((p) => pathname.startsWith(p));

  // The page scrolls with the document (this container only grows with its content), so the
  // document's scroll position is what says whether we are at the top. Checking only this
  // container's scrollTop, which is always 0, made any downward drag count as a pull.
  const atTop = useCallback(
    () => window.scrollY <= 0 && (scrollRef.current?.scrollTop ?? 0) <= 0,
    []
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (atTop()) startYRef.current = e.touches[0].clientY;
    },
    [atTop]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startYRef.current === null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta > 0 && atTop()) {
        setPullY(Math.min(delta * 0.45, THRESHOLD + 16));
      } else {
        // dragged back up, or the page started scrolling: this is not a pull any more
        startYRef.current = null;
        setPullY(0);
      }
    },
    [atTop]
  );

  const onTouchEnd = useCallback(() => {
    if (startYRef.current !== null && pullY >= THRESHOLD * 0.75) {
      if (shouldSync) {
        setIsSyncing(true);
        fetch("/api/plaid/sync-transactions", { method: "POST" })
          .finally(() => {
            setIsSyncing(false);
            startTransition(() => router.refresh());
          });
      } else {
        startTransition(() => router.refresh());
      }
    }
    setPullY(0);
    startYRef.current = null;
  }, [pullY, router, shouldSync]);

  const progress = Math.min(pullY / (THRESHOLD * 0.75), 1);
  const isActive = isSyncing || isPending;
  const isVisible = pullY > 4 || isActive;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto pb-20 relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull indicator: the circles come together as you pull, and orbit while it works. */}
      <div
        className="absolute left-0 right-0 flex justify-center z-30 pointer-events-none"
        style={{
          top: isVisible ? Math.max(pullY * 0.55, isActive ? 10 : 0) : -56,
          opacity: isVisible ? Math.max(progress, isActive ? 1 : 0) : 0,
          transition: pullY === 0 ? "top 0.2s, opacity 0.2s" : "none",
        }}
      >
        <div className="flex size-11 items-center justify-center rounded-full bg-white ring-1 ring-black/10">
          {isActive ? (
            <Mark width={28} state="syncing" />
          ) : (
            <Mark width={28} distance={24 - 12 * progress} />
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
