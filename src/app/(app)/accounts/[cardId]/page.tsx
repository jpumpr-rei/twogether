import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountDetailClient from "./AccountDetailClient";
import { parseDateFilter, dateFilterBounds } from "@/lib/dateFilter";
import type { TxRow, CategoryInfo } from "../../transactions/types";

export type AccountCardRow = {
  id: string;
  owner_id: string;
  institution_name: string;
  account_name: string;
  last_four: string | null;
  account_type: string;
  is_private: boolean;
};

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ cardId: string }>;
  searchParams: Promise<{ month?: string; from?: string; to?: string }>;
}) {
  const { cardId } = await params;
  const spParams = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cardData } = await supabase
    .from("cards")
    .select("id, owner_id, institution_name, account_name, last_four, account_type, is_private")
    .eq("id", cardId)
    .single();

  if (!cardData) redirect("/accounts");

  // Resolve owner display name
  const card = cardData as AccountCardRow;
  let ownerName = "Mine";
  if (card.owner_id !== user.id) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", card.owner_id)
      .single();
    ownerName = (ownerProfile?.display_name ?? ownerProfile?.email?.split("@")[0] ?? "Partner")
      .split(" ")[0];
  }

  const activeFilter = parseDateFilter(spParams);
  const { startDate, endDate } = dateFilterBounds(activeFilter);

  let txQuery = supabase
    .from("transactions")
    .select(
      `id, merchant_name, amount, date, is_pending, category_id, card_id,
       category:categories(id, name, icon, color),
       card:cards(institution_name, last_four)`
    )
    .eq("card_id", cardId)
    .order("date", { ascending: false })
    .limit(500);

  if (startDate) txQuery = txQuery.gte("date", startDate);
  if (endDate) txQuery = txQuery.lte("date", endDate);

  const [{ data: txData }, { data: catData }] = await Promise.all([
    txQuery,
    supabase.from("categories").select("id, name, icon, color").order("name"),
  ]);

  const baseTxs = (txData ?? []) as unknown as Omit<TxRow, "splits">[];

  // Fetch splits
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

  const transactions = baseTxs.map((tx) => ({ ...tx, splits: splitsMap.get(tx.id) ?? [] }));
  const categories = (catData ?? []) as CategoryInfo[];

  return (
    <AccountDetailClient
      card={card}
      transactions={transactions}
      categories={categories}
      activeFilter={activeFilter}
      cardId={cardId}
      ownerName={ownerName}
    />
  );
}
