"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Glass from "@/components/brand/Glass";
import Wordmark from "@/components/brand/Wordmark";
import { BRAND, HUES, RAMPS, SHARED_HUE, type HueKey } from "@/lib/brand/palette";
import {
  budgetCards,
  computeHero,
  filterByLens,
  type BudgetRow,
  type CardOwners,
  type SpendRow,
} from "@/lib/home/metrics";
import {
  LENS_COOKIE,
  type CategoryInfo,
  type Lens,
  type RecentTx,
  type TxPoint,
} from "@/lib/home/types";
import LensPill from "./LensPill";
import TrendCard from "./TrendCard";
import {
  BudgetCard,
  HeroCard,
  InsightsCard,
  NoBudgetsCard,
  RecentCard,
  SyncCard,
} from "./HomeCards";

type Person = { id: string; firstName: string };

function Avatar({ name, hue, className = "" }: { name: string; hue: HueKey; className?: string }) {
  return (
    <span
      className={`flex size-9 items-center justify-center rounded-full border-2 border-ink text-sm font-semibold ${className}`}
      style={{
        backgroundColor: HUES[hue].fill,
        // ink on persimmon (5.6:1) and white on ultramarine (5.2:1)
        color: hue === "ultramarine" ? "#FFFFFF" : "#0E0E10",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function HomeClient({
  me,
  partner,
  hues,
  initialLens,
  daysLeft,
  monthRows,
  chartRows,
  categories,
  budgets,
  recent,
  cardOwners,
  lastSyncedAt,
  bankCount,
}: {
  me: Person;
  partner: Person | null;
  hues: Record<string, HueKey>;
  initialLens: Lens;
  daysLeft: number;
  monthRows: SpendRow[];
  chartRows: TxPoint[];
  categories: CategoryInfo[];
  budgets: BudgetRow[];
  recent: RecentTx[];
  cardOwners: CardOwners;
  lastSyncedAt: string | null;
  bankCount: number;
}) {
  const router = useRouter();
  const [lens, setLens] = useState<Lens>(initialLens);

  function changeLens(next: Lens) {
    setLens(next);
    // Remembered across visits; the server reads it so the first paint is already right.
    document.cookie = `${LENS_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const people = useMemo(() => ({ me: me.id, partner: partner?.id ?? null }), [me.id, partner]);
  const hueOf = (id: string): HueKey => hues[id] ?? "persimmon";

  // Whose colour the screen is wearing: the overlap for Ours, otherwise that person's hue.
  const lensHue =
    lens === "mine" ? hueOf(me.id) : lens === "theirs" && partner ? hueOf(partner.id) : null;
  const ramp = lensHue ? RAMPS[HUES[lensHue].ramp] : RAMPS[SHARED_HUE.ramp];
  const accent = lensHue ? HUES[lensHue].onDark : SHARED_HUE.onDark;

  const hero = useMemo(
    () => computeHero({ rows: monthRows, budgets, lens, people, cardOwners, daysLeft }),
    [monthRows, budgets, lens, people, cardOwners, daysLeft]
  );
  const cards = useMemo(
    () => budgetCards({ rows: monthRows, budgets, lens, people, cardOwners, limit: 3 }),
    [monthRows, budgets, lens, people, cardOwners]
  );
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const recentShown = useMemo(
    () => filterByLens(recent, lens, people, cardOwners).slice(0, 5),
    [recent, lens, people, cardOwners]
  );

  const barColors = {
    mine: HUES[hueOf(me.id)].fill,
    theirs: partner ? HUES[hueOf(partner.id)].fill : BRAND.us,
    shared: BRAND.us,
  };

  return (
    <>
      <Glass ramp={ramp} />
      <div className="relative z-10 space-y-2.5 px-3 pb-40 pt-4">
        <header className="flex items-center justify-between">
          <Wordmark className="text-[26px] text-white" />
          <Link href="/settings" aria-label="Settings" className="flex">
            <Avatar name={me.firstName} hue={hueOf(me.id)} />
            {partner ? (
              <Avatar name={partner.firstName} hue={hueOf(partner.id)} className="-ml-2" />
            ) : null}
          </Link>
        </header>

        {partner ? <LensPill lens={lens} onChange={changeLens} /> : null}

        <HeroCard hero={hero} lens={lens} partnerName={partner?.firstName} />

        {cards.length > 0 ? (
          cards.map((c) => (
            <BudgetCard
              key={c.categoryId}
              data={c}
              category={catMap.get(c.categoryId)}
              lens={lens}
              colors={barColors}
              names={{ mine: me.firstName, theirs: partner?.firstName ?? null }}
            />
          ))
        ) : (
          <NoBudgetsCard />
        )}

        <SyncCard
          lastSyncedAt={lastSyncedAt}
          bankCount={bankCount}
          onSynced={() => router.refresh()}
        />

        <InsightsCard />

        <TrendCard
          transactions={chartRows}
          categories={categories}
          budgets={budgets}
          lens={lens}
          people={people}
          cardOwners={cardOwners}
          accent={accent}
        />

        <RecentCard items={recentShown} categories={catMap} />
      </div>
    </>
  );
}
