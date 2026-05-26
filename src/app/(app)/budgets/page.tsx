import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BudgetsClient from "./BudgetsClient";
import type { CategoryRow, BudgetRow, BudgetSlot } from "./types";

export default async function BudgetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const coupleId: string | null = profile?.couple_id ?? null;

  // Fetch all available categories
  let categories: CategoryRow[] = [];
  if (coupleId) {
    const { data } = await supabase
      .from("categories")
      .select("id, name, icon, color")
      .or(`is_default.eq.true,couple_id.eq.${coupleId}`)
      .order("name");
    categories = (data ?? []) as CategoryRow[];
  } else {
    const { data } = await supabase
      .from("categories")
      .select("id, name, icon, color")
      .eq("is_default", true)
      .order("name");
    categories = (data ?? []) as CategoryRow[];
  }

  // Fetch existing budgets
  let budgets: BudgetRow[] = [];
  if (coupleId) {
    const { data } = await supabase
      .from("budgets")
      .select("id, name, amount, period, category_id")
      .eq("couple_id", coupleId);
    budgets = (data ?? []) as BudgetRow[];
  }

  // Current-month spending per category (direct + split amounts)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];
  const spending: Record<string, number> = {};
  if (coupleId) {
    const { data: txs } = await supabase
      .from("transactions")
      .select("id, category_id, amount")
      .eq("couple_id", coupleId)
      .gte("date", startOfMonth)
      .gt("amount", 0);

    const txList = (txs ?? []) as { id: string; category_id: string | null; amount: number }[];

    // Direct (non-split) transactions
    for (const tx of txList) {
      if (tx.category_id) {
        spending[tx.category_id] = (spending[tx.category_id] ?? 0) + tx.amount;
      }
    }

    // Split amounts
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

  // Merge: one slot per category
  const budgetMap = new Map(budgets.map((b) => [b.category_id ?? "", b]));
  const slots: BudgetSlot[] = categories.map((cat) => ({
    category: cat,
    budget: budgetMap.get(cat.id) ?? null,
    spent: spending[cat.id] ?? 0,
  })).sort((a, b) => {
    // Budgets with an amount set first (high→low), unset ones at bottom
    if (a.budget && b.budget) return b.budget.amount - a.budget.amount;
    if (a.budget) return -1;
    if (b.budget) return 1;
    return a.category.name.localeCompare(b.category.name);
  });

  return <BudgetsClient slots={slots} />;
}
