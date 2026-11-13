import { cookies } from "next/headers";
import Link from "next/link";
import { getAuth } from "@/lib/supabase/auth";
import { budgetPeriodBounds } from "@/lib/budgetPeriod";
import { assignHues, RAMPS } from "@/lib/brand/palette";
import { daysLeftInMonth, type BudgetRow, type SpendRow } from "@/lib/home/metrics";
import {
  LENS_COOKIE,
  parseLens,
  type CategoryInfo,
  type RecentTx,
  type TxPoint,
} from "@/lib/home/types";
import Glass from "@/components/brand/Glass";
import Wordmark from "@/components/brand/Wordmark";
import HomeClient from "./HomeClient";

const pad = (n: number) => String(n).padStart(2, "0");

const firstName = (displayName: string | null, email: string | null | undefined) =>
  (displayName ?? email?.split("@")[0] ?? "there").split(" ")[0];

export default async function DashboardPage() {
  const { supabase, user, profile } = await getAuth();
  const coupleId = profile?.couple_id ?? null;

  if (!coupleId) {
    const name = firstName(profile?.display_name ?? null, user.email);
    return (
      <>
        <Glass ramp={RAMPS.us} />
        <div className="relative z-10 space-y-2.5 px-3 pb-40 pt-4">
          <header className="flex items-center">
            <Wordmark className="text-[26px] text-white" />
          </header>
          <div className="rounded-hero bg-white p-6 text-ink">
            <p className="text-sm text-mute-light">Good to see you,</p>
            <p className="font-display text-[44px] font-extrabold leading-[0.95] tracking-[-0.03em]">
              {name}
            </p>
            <p className="mt-5 text-lg font-semibold">Connect with your partner</p>
            <p className="mt-1 text-sm text-mute-light">
              Share an invite code to link accounts and start tracking budgets together.
            </p>
            <Link
              href="/settings"
              className="mt-5 inline-flex rounded-full bg-lime px-5 py-3 text-[15px] font-semibold text-ink active:scale-95"
            >
              Set up your household
            </Link>
          </div>
        </div>
      </>
    );
  }

  const now = new Date();
  const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const { startDate: monthStart, endDate: monthEnd } = budgetPeriodBounds({ type: "month", month });

  // 13 months of data for the trend chart (current + 12 past)
  const chartStart = new Date();
  chartStart.setDate(1);
  chartStart.setMonth(chartStart.getMonth() - 12);
  const chartFrom = chartStart.toISOString().split("T")[0];

  const lens = parseLens((await cookies()).get(LENS_COOKIE)?.value);

  // Everything below is independent, so it all runs in one parallel batch.
  // The two queries that join tables the generated types don't describe go through `any`,
  // as the Budgets page does.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const [chart, monthRows, categories, recent, budgets, members, cards, couple] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount, date, category_id, card_id")
      .eq("couple_id", coupleId)
      .gte("date", chartFrom),
    // This month with its splits, in the shape the Budgets page uses, so the numbers agree.
    db
      .from("transactions")
      .select("amount, category_id, card_id, splits:transaction_splits(category_id, amount)")
      .eq("couple_id", coupleId)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase
      .from("categories")
      .select("id, name, icon, color")
      .or(`is_default.eq.true,couple_id.eq.${coupleId}`)
      .order("name"),
    // More than the five shown, because the lens can filter some out.
    supabase
      .from("transactions")
      .select("id, merchant_name, amount, date, category_id, card_id")
      .eq("couple_id", coupleId)
      .order("date", { ascending: false })
      .limit(25),
    supabase.from("budgets").select("category_id, amount, period").eq("couple_id", coupleId),
    supabase.from("profiles").select("id, display_name, email, created_at").eq("couple_id", coupleId),
    supabase
      .from("cards")
      .select("id, owner_id, institution_name")
      .eq("couple_id", coupleId)
      .eq("is_active", true),
    db.from("couples").select("last_synced_at").eq("id", coupleId).single(),
  ]);

  const people = (members.data ?? []).map((p) => ({
    id: p.id,
    createdAt: p.created_at,
    firstName: firstName(p.display_name, p.email),
  }));
  const hues = assignHues(people);
  const me = people.find((p) => p.id === user.id) ?? {
    id: user.id,
    createdAt: "",
    firstName: firstName(profile?.display_name ?? null, user.email),
  };
  const partner = people.find((p) => p.id !== user.id) ?? null;

  const cardRows = cards.data ?? [];
  const cardOwners = Object.fromEntries(cardRows.map((c) => [c.id, c.owner_id]));
  const bankCount = new Set(cardRows.map((c) => c.institution_name)).size;

  return (
    <HomeClient
      me={{ id: me.id, firstName: me.firstName }}
      partner={partner ? { id: partner.id, firstName: partner.firstName } : null}
      hues={hues}
      initialLens={partner ? lens : "ours"}
      daysLeft={daysLeftInMonth(now)}
      monthRows={(monthRows.data ?? []) as SpendRow[]}
      chartRows={(chart.data ?? []) as TxPoint[]}
      categories={(categories.data ?? []) as CategoryInfo[]}
      budgets={(budgets.data ?? []) as BudgetRow[]}
      recent={(recent.data ?? []) as RecentTx[]}
      cardOwners={cardOwners}
      lastSyncedAt={(couple.data as { last_synced_at: string | null } | null)?.last_synced_at ?? null}
      bankCount={bankCount}
    />
  );
}
