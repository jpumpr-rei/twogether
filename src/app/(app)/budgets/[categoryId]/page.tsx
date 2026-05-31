import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CategoryDetailClient from "./CategoryDetailClient";
import { parseBudgetPeriod, budgetPeriodBounds } from "@/lib/budgetPeriod";
import type { CategoryRow, BudgetRow } from "../types";
import type { CategoryInfo, TxRow } from "../../transactions/types";

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
    .select("id, name, icon, color, is_default")
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

  // Splits embedded directly to avoid a separate .in() call that can exceed URL limits.
  const TX_SELECT = `
    id, merchant_name, amount, date, is_pending, is_transfer, category_id, card_id,
    category:categories(id, name, icon, color),
    card:cards(institution_name, account_name, last_four),
    splits:transaction_splits(id, category_id, amount, category:categories(id, name, icon, color))
  `;

  let transactions: TxRow[] = [];
  let splitAmountOverrides: Record<string, number> = {};
  let allCategories: CategoryInfo[] = [];

  if (coupleId) {
    // Fetch direct transactions, all categories, and split rows for this category in parallel
    const [{ data: txData }, { data: catData }, { data: splitLookup }] = await Promise.all([
      // Direct transactions — category_id matches
      supabase
        .from("transactions")
        .select(TX_SELECT)
        .eq("couple_id", coupleId)
        .eq("category_id", categoryId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false }),
      supabase.from("categories").select("id, name, icon, color").order("name"),
      // All split rows attributed to this category (no date filter — filter by parent tx date below)
      supabase
        .from("transaction_splits")
        .select("transaction_id, amount")
        .eq("category_id", categoryId),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const directTxs = (txData ?? []).map((tx: any) => ({ ...tx, splits: tx.splits ?? [] })) as TxRow[];
    const directTxIds = new Set(directTxs.map((t) => t.id));

    // Build map: parent tx id → split amount for this category
    // (splitLookup only contains splits for THIS category, used to find parent tx IDs
    //  and to compute the per-category spend amount for the progress bar)
    const splitsByTxId = new Map<string, number>();
    for (const s of (splitLookup ?? []) as { transaction_id: string; amount: number }[]) {
      splitsByTxId.set(s.transaction_id, s.amount);
    }

    // Fetch the parent transactions that were split into this category
    // (they have category_id = null so the direct query missed them)
    let splitParentTxs: TxRow[] = [];
    const splitParentIds = [...splitsByTxId.keys()].filter((id) => !directTxIds.has(id));

    if (splitParentIds.length > 0) {
      const { data: splitTxData } = await supabase
        .from("transactions")
        .select(TX_SELECT)
        .eq("couple_id", coupleId)
        .in("id", splitParentIds)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      splitParentTxs = (splitTxData ?? []).map((tx: any) => ({ ...tx, splits: tx.splits ?? [] })) as TxRow[];
    }

    // Merge and re-sort by date descending
    const allBaseTxs = [...directTxs, ...splitParentTxs].sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    // Build splitAmountOverrides — for split-parent transactions, show only this
    // category's portion of the total amount in the list and progress bar.
    for (const tx of allBaseTxs) {
      if (splitsByTxId.has(tx.id)) {
        splitAmountOverrides[tx.id] = splitsByTxId.get(tx.id)!;
      }
    }

    transactions = allBaseTxs;
    allCategories = (catData ?? []) as CategoryInfo[];
  }

  // Net spending — use the split amount for split transactions, full amount otherwise
  const spent = transactions.reduce((s, tx) => {
    const amt = splitAmountOverrides[tx.id] ?? tx.amount;
    return s + amt;
  }, 0);

  return (
    <CategoryDetailClient
      category={category}
      budget={budget}
      transactions={transactions}
      allCategories={allCategories}
      spent={spent}
      activePeriod={activePeriod}
      splitAmountOverrides={splitAmountOverrides}
    />
  );
}
