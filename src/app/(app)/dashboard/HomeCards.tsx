"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SyncButton, { formatLastSynced } from "@/components/ui/SyncButton";
import type { BudgetCardData, Hero } from "@/lib/home/metrics";
import type { CategoryInfo, Lens, RecentTx } from "@/lib/home/types";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const displayType = "font-display font-extrabold leading-[0.95] tracking-[-0.03em]";

// ── The big number ──────────────────────────────────────────────────────────────────────────────

export function HeroCard({
  hero,
  lens,
  partnerName,
}: {
  hero: Hero;
  lens: Lens;
  partnerName: string | undefined;
}) {
  let label: string;
  let sub: string | null = null;

  switch (hero.kind) {
    case "left":
      label = "Left this month";
      sub = `About ${money(hero.perDay)} a day for ${hero.daysLeft} more ${hero.daysLeft === 1 ? "day" : "days"}`;
      break;
    case "over":
      label = "Over this month";
      sub = `${money(hero.spent)} spent of ${money(hero.budgeted)} budgeted`;
      break;
    case "spent":
      label =
        lens === "mine"
          ? "You've spent this month"
          : lens === "theirs"
            ? `${partnerName ?? "They"} spent this month`
            : "Spent this month";
      sub =
        hero.sharePct !== null
          ? `${hero.sharePct}% of what the two of you spent`
          : hero.hasBudgets
            ? null
            : "Set a budget to see what's left";
      break;
  }

  return (
    <section className="rounded-hero bg-white p-5 text-ink">
      <p className="text-sm text-mute-light">{label}</p>
      <p className={`mt-1.5 text-[clamp(52px,20vw,84px)] tabular-nums ${displayType}`}>
        {money(hero.amount)}
      </p>
      {sub ? <p className="mt-3 text-sm text-mute-light">{sub}</p> : null}
      {hero.kind === "spent" && !hero.hasBudgets && lens === "ours" ? (
        <Link
          href="/budgets"
          className="mt-4 inline-flex rounded-full bg-lime px-5 py-3 text-[15px] font-semibold text-ink active:scale-95"
        >
          Set a budget
        </Link>
      ) : null}
    </section>
  );
}

// ── A budget, closest to its limit first ────────────────────────────────────────────────────────

export type BarColors = { mine: string; theirs: string; shared: string };

export function BudgetCard({
  data,
  category,
  lens,
  colors,
  names,
}: {
  data: BudgetCardData;
  category: CategoryInfo | undefined;
  lens: Lens;
  colors: BarColors;
  names: { mine: string; theirs: string | null };
}) {
  const pct = Math.round(data.pct * 100);

  // Ours: a segment per person (and one for hand-entered items), scaled to fit when over budget.
  // Mine and Theirs: only that person's segment, out of the household's budget.
  const scale = data.householdSpent > data.budget ? data.budget / data.householdSpent : 1;
  const width = (value: number) => `${Math.min(100, (value * scale * 100) / data.budget)}%`;
  const segments =
    lens === "ours"
      ? [
          { key: "mine", value: data.shares.mine, color: colors.mine },
          { key: "theirs", value: data.shares.theirs, color: colors.theirs },
          { key: "shared", value: data.shares.shared, color: colors.shared },
        ]
      : [
          {
            key: lens,
            value: data.lensSpent,
            color: lens === "mine" ? colors.mine : colors.theirs,
          },
        ];

  return (
    <Link
      href={`/budgets/${data.categoryId}`}
      className="block rounded-card bg-card p-4 transition-transform duration-150 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-mute-dark">{pct}% used</p>
        {data.over > 0 ? (
          <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink">
            Over by {money(data.over)}
          </span>
        ) : null}
      </div>
      <p className={`mt-1 text-[28px] text-white ${displayType}`}>
        {category?.icon ? <span className="mr-1.5 text-[22px]">{category.icon}</span> : null}
        {category?.name ?? "Budget"}
      </p>
      <div
        className="mt-3 flex h-3 overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={`${pct}% of the ${money(data.budget)} budget used`}
      >
        {segments.map((s) => (
          <span
            key={s.key}
            style={{ width: width(s.value), backgroundColor: s.color }}
            className="transition-[width] duration-300"
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[13px] text-white">
        <span>
          {money(data.lensSpent)} of {money(data.budget)}
        </span>
        {lens === "ours" && names.theirs ? (
          <span className="text-mute-dark">
            {names.mine} {money(data.shares.mine)} · {names.theirs} {money(data.shares.theirs)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function NoBudgetsCard() {
  return (
    <Link
      href="/budgets"
      className="block rounded-card bg-card p-4 transition-transform duration-150 active:scale-[0.99]"
    >
      <p className={`text-[26px] text-white ${displayType}`}>No budgets yet</p>
      <p className="mt-1 text-sm text-mute-dark">
        Set one for groceries or dining out and it shows up here.
      </p>
    </Link>
  );
}

// ── Sync ────────────────────────────────────────────────────────────────────────────────────────

export function SyncCard({
  lastSyncedAt,
  bankCount,
  onSynced,
}: {
  lastSyncedAt: string | null;
  bankCount: number;
  onSynced: () => void;
}) {
  // Rendered after mount so the relative time never disagrees with the server's.
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setLabel(formatLastSynced(lastSyncedAt));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [lastSyncedAt]);

  const banks = `${bankCount} ${bankCount === 1 ? "bank" : "banks"}`;

  return (
    <section className="flex items-center justify-between gap-3 rounded-card bg-card px-4 py-3.5">
      <div>
        <p className={`text-[22px] text-white ${displayType}`}>
          {lastSyncedAt ? (label ? `Synced ${label}` : "Synced") : "Not synced yet"}
        </p>
        <p className="mt-1 text-xs text-mute-dark">{bankCount > 0 ? banks : "No banks linked"}</p>
      </div>
      <SyncButton tone="dark" showTime={false} lastSyncedAt={lastSyncedAt} onSynced={onSynced} />
    </section>
  );
}

// ── Insights ────────────────────────────────────────────────────────────────────────────────────

const INSIGHT_CACHE_PREFIX = "tw_insights_";

export function InsightsCard() {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${INSIGHT_CACHE_PREFIX}${new Date().toISOString().split("T")[0]}`;

    let cached: unknown = null;
    try {
      cached = JSON.parse(sessionStorage.getItem(cacheKey) ?? "null");
    } catch {
      /* ignore */
    }
    const hasCache = Array.isArray(cached) && cached.length > 0;

    // Today's insights are kept for the session. State is only set from the promise callbacks,
    // which also means nothing is set after the card has gone.
    const request: Promise<{ insights?: unknown }> = hasCache
      ? Promise.resolve({ insights: cached })
      : fetch("/api/ai/insights").then((r) => r.json());

    request
      .then((data) => {
        if (cancelled || !Array.isArray(data.insights) || data.insights.length === 0) return;
        setInsights(data.insights as string[]);
        if (!hasCache) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(data.insights));
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        /* degrade gracefully */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-card bg-card p-4">
      <p className={`text-[26px] text-white ${displayType}`}>Insights</p>
      {loading ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="size-6 flex-none animate-pulse rounded-full bg-line" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-5/6 animate-pulse rounded-full bg-line" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-line" />
              </div>
            </div>
          ))}
        </div>
      ) : insights.length > 0 ? (
        <ol className="mt-4 space-y-3.5">
          {insights.map((insight, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-6 flex-none items-center justify-center rounded-full bg-lime text-xs font-semibold text-ink">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-white/90">{insight}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-mute-dark">
          Insights will appear once you have more transaction history.
        </p>
      )}
    </section>
  );
}

// ── Recent activity ─────────────────────────────────────────────────────────────────────────────

export function RecentCard({
  items,
  categories,
}: {
  items: RecentTx[];
  categories: Map<string, CategoryInfo>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-card bg-white p-4 text-ink">
      <div className="flex items-center justify-between">
        <p className={`text-[26px] ${displayType}`}>Recent</p>
        <Link href="/transactions" className="text-sm font-semibold underline underline-offset-4">
          See all
        </Link>
      </div>
      <div className="mt-3 divide-y divide-gray-100">
        {items.map((tx) => {
          const cat = tx.category_id ? categories.get(tx.category_id) : undefined;
          const isCredit = tx.amount < 0;
          return (
            <div key={tx.id} className="flex items-center gap-3 py-2.5">
              <div
                className="flex size-10 flex-none items-center justify-center rounded-full text-lg"
                style={{ backgroundColor: cat?.color ? `${cat.color}22` : "#f3f4f6" }}
              >
                {cat?.icon ?? "📦"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tx.merchant_name ?? "Unknown merchant"}</p>
                <p className="text-xs text-mute-light">{tx.date}</p>
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${isCredit ? "text-emerald-700" : ""}`}
              >
                {isCredit ? "+" : ""}$
                {Math.abs(tx.amount).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
