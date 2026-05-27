import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CategoryDetailClient from "./CategoryDetailClient";
import { parseBudgetPeriod, budgetPeriodBounds } from "@/lib/budgetPeriod";
import type { CategoryRow, BudgetRow } from "../types";
import type { CategoryInfo } from "../../transactions/types";

export type TxRow = {
  id: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  is_pending: boolean;
  category_id: string | null;
};

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ view?: string; month?: string; year?: string; from?: string; to?: string }>;
}) {
  const { categoryId } = await params;
  const sp = await searchParams;
  const activePeriod = parseBudgetPeriod(sp);
  const { startDate, endDate } = budgetPeriodBounds(activePeriod);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();

  const coupleId = profile?.couple_id ?? null;

  // Fetch the category
  const { data: categoryData } = await supabase
    .from("categories")
    .select("id, name, icon, color")
    .eq("id", categoryId)
    .single();

  if (!categoryData) redirect("/budgets");
  const category = categoryData as CategoryRow;

  // Fetch the budget for this category
  let budget: BudgetRow | null = null;
  if (coupleId) {
    const { data } = await supabase
      .from("budgets")
      .select("id, name, amount, period, category_id")
      .eq("couple_id", coupleId)
      .eq("category_id", categoryId)
      .maybeSingle();
    budget = (data as BudgetRow | null) ?? null;
  }

  let transactions: TxRow[] = [];
  let allCategories: CategoryInfo[] = [];
  if (coupleId) {
    const [{ data: txData }, { data: catData }] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, merchant_name, amount, date, is_pending, category_id")
        .eq("couple_id", coupleId)
        .eq("category_id", categoryId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false }),
      supabase.from("categories").select("id, name, icon, color").order("name"),
    ]);
    transactions = (txData ?? []) as TxRow[];
    allCategories = (catData ?? []) as CategoryInfo[];
  }

  // Direct spending + any split amounts for this category in the period
  const directSpent = transactions
    .filter((tx) => tx.amount > 0)
    .reduce((s, tx) => s + tx.amount, 0);

  let splitSpent = 0;
  if (coupleId) {
    const txIds = transactions.map((t) => t.id);
    if (txIds.length > 0) {
      const { data: splits } = await supabase
        .from("transaction_splits")
        .select("amount")
        .in("transaction_id", txIds)
        .eq("category_id", categoryId)
        .gt("amount", 0);
      splitSpent = ((splits ?? []) as { amount: number }[]).reduce(
        (s, sp) => s + sp.amount,
        0
      );
    }
  }

  const spent = directSpent + splitSpent;

  return (
    <CategoryDetailClient
      category={category}
      budget={budget}
      transactions={transactions}
      allCategories={allCategories}
      spent={spent}
      activePeriod={activePeriod}
    />
  );
}
