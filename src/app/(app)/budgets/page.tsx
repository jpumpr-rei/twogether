import { getAuth } from "@/lib/supabase/auth";
import BudgetsClient from "./BudgetsClient";
import { parseBudgetPeriod, budgetPeriodBounds, comparisonBounds } from "@/lib/budgetPeriod";
import type { CategoryRow, BudgetRow, BudgetSlot } from "./types";

type SpendTx = {
  category_id: string | null;
  amount: number;
  splits: { category_id: string | null; amount: number }[] | null;
};

// Splits are embedded in the same request (one round trip, and no long
// .in("transaction_id", [...]) list that can overflow the URL and silently return nothing).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchSpendTxs(supabase: any, coupleId: string, startDate: string, endDate: string): Promise<SpendTx[]> {
  const { data } = await supabase
    .from("transactions")
    .select("category_id, amount, splits:transaction_splits(category_id, amount)")
    .eq("couple_id", coupleId)
    .gte("date", startDate)
    .lte("date", endDate);
  return (data ?? []) as SpendTx[];
}

// Total spend for a comparison period: categorized transactions plus every positive split.
function totalSpent(txs: SpendTx[]): number {
  let total = 0;
  for (const tx of txs) {
    if (tx.category_id) total += tx.amount;
    for (const s of tx.splits ?? []) if (s.amount > 0) total += s.amount;
  }
  return total;
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; year?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const activePeriod = parseBudgetPeriod(sp);
  const { startDate, endDate } = budgetPeriodBounds(activePeriod);
  const { prevBounds, yoyBounds } = comparisonBounds(activePeriod);

  const { supabase, profile } = await getAuth();
  const coupleId: string | null = profile?.couple_id ?? null;

  // Everything below is independent of everything else once we know the household,
  // so it all runs in a single parallel batch.
  const [categoriesResult, budgetsResult, currentTxs, prevTxs, yoyTxs] = await Promise.all([
    coupleId
      ? supabase
          .from("categories")
          .select("id, name, icon, color")
          .or(`is_default.eq.true,couple_id.eq.${coupleId}`)
          .order("name")
      : supabase
          .from("categories")
          .select("id, name, icon, color")
          .eq("is_default", true)
          .order("name"),
    coupleId
      ? supabase
          .from("budgets")
          .select("id, name, amount, period, category_id")
          .eq("couple_id", coupleId)
      : Promise.resolve({ data: [] }),
    coupleId ? fetchSpendTxs(supabase, coupleId, startDate, endDate) : Promise.resolve([] as SpendTx[]),
    coupleId && prevBounds
      ? fetchSpendTxs(supabase, coupleId, prevBounds.startDate, prevBounds.endDate)
      : Promise.resolve(null),
    coupleId && yoyBounds
      ? fetchSpendTxs(supabase, coupleId, yoyBounds.startDate, yoyBounds.endDate)
      : Promise.resolve(null),
  ]);

  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const budgets = (budgetsResult.data ?? []) as BudgetRow[];

  // Spending for the selected period (per category, for slot assembly)
  const spending: Record<string, number> = {};
  for (const tx of currentTxs) {
    if (tx.category_id) {
      spending[tx.category_id] = (spending[tx.category_id] ?? 0) + tx.amount;
    }
    for (const s of tx.splits ?? []) {
      if (s.category_id && s.amount > 0) {
        spending[s.category_id] = (spending[s.category_id] ?? 0) + s.amount;
      }
    }
  }
  const periodTotal = Object.values(spending).reduce((s, v) => s + v, 0);
  const prevSpent = prevTxs ? totalSpent(prevTxs) : null;
  const yoySpent = yoyTxs ? totalSpent(yoyTxs) : null;

  const budgetMap = new Map(budgets.map((b) => [b.category_id ?? "", b]));
  const slots: BudgetSlot[] = categories
    .map((cat) => ({
      category: cat,
      budget: budgetMap.get(cat.id) ?? null,
      spent: spending[cat.id] ?? 0,
    }))
    .sort((a, b) => {
      if (a.budget && b.budget) return b.budget.amount - a.budget.amount;
      if (a.budget) return -1;
      if (b.budget) return 1;
      return a.category.name.localeCompare(b.category.name);
    });

  return (
    <BudgetsClient
      slots={slots}
      activePeriod={activePeriod}
      totalSpent={periodTotal}
      prevSpent={prevSpent}
      yoySpent={yoySpent}
    />
  );
}
