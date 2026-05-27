import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BudgetsClient from "./BudgetsClient";
import { parseBudgetPeriod, budgetPeriodBounds } from "@/lib/budgetPeriod";
import type { CategoryRow, BudgetRow, BudgetSlot } from "./types";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; year?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const activePeriod = parseBudgetPeriod(sp);
  const { startDate, endDate } = budgetPeriodBounds(activePeriod);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const coupleId: string | null = profile?.couple_id ?? null;

  // Fetch categories and budgets in parallel
  const [categoriesResult, budgetsResult] = await Promise.all([
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
  ]);

  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const budgets = (budgetsResult.data ?? []) as BudgetRow[];

  // Spending for the selected period
  const spending: Record<string, number> = {};
  if (coupleId) {
    const { data: txs } = await supabase
      .from("transactions")
      .select("id, category_id, amount")
      .eq("couple_id", coupleId)
      .gte("date", startDate)
      .lte("date", endDate);

    const txList = (txs ?? []) as { id: string; category_id: string | null; amount: number }[];

    for (const tx of txList) {
      if (tx.category_id) {
        spending[tx.category_id] = (spending[tx.category_id] ?? 0) + tx.amount;
      }
    }

    const txIds = txList.map((t) => t.id);
    if (txIds.length > 0) {
      const { data: splits } = await supabase
        .from("transaction_splits")
        .select("category_id, amount")
        .in("transaction_id", txIds)
        .gt("amount", 0);
      for (const s of (splits ?? []) as { category_id: string | null; amount: number }[]) {
        if (s.category_id) {
          spending[s.category_id] = (spending[s.category_id] ?? 0) + s.amount;
        }
      }
    }
  }

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

  return <BudgetsClient slots={slots} activePeriod={activePeriod} />;
}
