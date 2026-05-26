import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TransactionsClient from "./TransactionsClient";
import { parseDateFilter, dateFilterBounds } from "@/components/ui/DateFilterSheet";
import type { TxRow, CategoryInfo, CardInfo } from "./types";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;

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

  const activeFilter = parseDateFilter(params);
  const { startDate, endDate } = dateFilterBounds(activeFilter);

  let transactions: TxRow[] = [];
  let categories: CategoryInfo[] = [];
  let cards: CardInfo[] = [];

  if (coupleId) {
    let txQuery = supabase
      .from("transactions")
      .select(
        `id, merchant_name, amount, date, is_pending, category_id, card_id,
         category:categories(id, name, icon, color),
         card:cards(institution_name, last_four)`
      )
      .eq("couple_id", coupleId)
      .order("date", { ascending: false })
      .limit(500);

    if (startDate) txQuery = txQuery.gte("date", startDate);
    if (endDate) txQuery = txQuery.lte("date", endDate);

    const [{ data: txData }, { data: catData }, { data: cardData }] = await Promise.all([
      txQuery,
      supabase.from("categories").select("id, name, icon, color").order("name"),
      supabase
        .from("cards")
        .select("id, institution_name, account_name, last_four")
        .eq("couple_id", coupleId)
        .eq("is_active", true)
        .order("institution_name"),
    ]);

    const baseTxs = (txData ?? []) as unknown as Omit<TxRow, "splits">[];

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
    cards = (cardData ?? []) as CardInfo[];
  }

  return (
    <TransactionsClient
      transactions={transactions}
      categories={categories}
      cards={cards}
      activeFilter={activeFilter}
    />
  );
}
