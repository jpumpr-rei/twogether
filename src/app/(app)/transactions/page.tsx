import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TransactionsClient from "./TransactionsClient";
import { parseDateFilter, dateFilterBounds } from "@/lib/dateFilter";
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

  // Fetch last sync time
  let lastSyncedAt: string | null = null;
  if (coupleId) {
    const { data: couple } = await supabase
      .from("couples")
      .select("last_synced_at")
      .eq("id", coupleId)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lastSyncedAt = (couple as any)?.last_synced_at ?? null;
  }

  let transactions: TxRow[] = [];
  let categories: CategoryInfo[] = [];
  let cards: CardInfo[] = [];

  if (coupleId) {
    // Embed splits directly in the transaction query to avoid a separate
    // .in("transaction_id", [...]) call that can exceed URL length limits
    // when there are many transactions (All Time with 500+ rows).
    let txQuery = supabase
      .from("transactions")
      .select(
        `id, merchant_name, amount, date, is_pending, is_transfer, category_id, card_id,
         category:categories(id, name, icon, color),
         card:cards(institution_name, account_name, last_four),
         splits:transaction_splits(id, category_id, amount, category:categories(id, name, icon, color))`
      )
      .eq("couple_id", coupleId)
      .order("date", { ascending: false });

    if (startDate) txQuery = txQuery.gte("date", startDate);
    if (endDate) txQuery = txQuery.lte("date", endDate);

    // Cap date-filtered views; All Time is naturally bounded by the 90-day sync window.
    if (startDate || endDate) txQuery = txQuery.limit(500);

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactions = (txData ?? []).map((tx: any) => ({ ...tx, splits: tx.splits ?? [] })) as TxRow[];
    categories = (catData ?? []) as CategoryInfo[];
    cards = (cardData ?? []) as CardInfo[];
  }

  return (
    <TransactionsClient
      transactions={transactions}
      categories={categories}
      cards={cards}
      activeFilter={activeFilter}
      lastSyncedAt={lastSyncedAt}
    />
  );
}
