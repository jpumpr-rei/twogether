import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TransactionsClient from "./TransactionsClient";
import type { TxRow, CategoryInfo } from "./types";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();

  const coupleId = profile?.couple_id ?? null;

  let transactions: TxRow[] = [];
  let categories: CategoryInfo[] = [];

  if (coupleId) {
    const [{ data: txData }, { data: catData }] = await Promise.all([
      supabase
        .from("transactions")
        .select(
          `id, merchant_name, amount, date, is_pending, category_id,
           category:categories(id, name, icon, color),
           card:cards(institution_name, last_four)`
        )
        .eq("couple_id", coupleId)
        .order("date", { ascending: false })
        .limit(200),
      supabase
        .from("categories")
        .select("id, name, icon, color")
        .order("name"),
    ]);

    const baseTxs = (txData ?? []) as unknown as Omit<TxRow, "splits">[];

    // Fetch splits separately — if the table doesn't exist yet, degrade gracefully
    let splitsMap = new Map<string, TxRow["splits"]>();
    if (baseTxs.length > 0) {
      const txIds = baseTxs.map((t) => t.id);
      const { data: splitData } = await supabase
        .from("transaction_splits")
        .select("id, transaction_id, category_id, amount, category:categories(id, name, icon, color)")
        .in("transaction_id", txIds);

      for (const s of (splitData ?? []) as (TxRow["splits"][number] & { transaction_id: string })[]) {
        const arr = splitsMap.get(s.transaction_id) ?? [];
        arr.push(s);
        splitsMap.set(s.transaction_id, arr);
      }
    }

    transactions = baseTxs.map((tx) => ({ ...tx, splits: splitsMap.get(tx.id) ?? [] }));
    categories = (catData ?? []) as CategoryInfo[];
  }

  return <TransactionsClient transactions={transactions} categories={categories} />;
}
