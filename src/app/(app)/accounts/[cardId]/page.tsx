import { getAuth } from "@/lib/supabase/auth";
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

  const { supabase, user, profile } = await getAuth();
  const coupleId = profile?.couple_id ?? null;

  const activeFilter = parseDateFilter(spParams);
  const { startDate, endDate } = dateFilterBounds(activeFilter);

  // Splits are embedded in the transaction query (one round trip, and no long
  // .in("transaction_id", [...]) list that can overflow the URL).
  let txQuery = supabase
    .from("transactions")
    .select(
      `id, merchant_name, amount, date, is_pending, category_id, card_id,
       category:categories(id, name, icon, color),
       card:cards(institution_name, last_four),
       splits:transaction_splits(id, category_id, amount, category:categories(id, name, icon, color))`
    )
    .eq("card_id", cardId)
    .order("date", { ascending: false })
    .limit(500);

  if (startDate) txQuery = txQuery.gte("date", startDate);
  if (endDate) txQuery = txQuery.lte("date", endDate);

  // The card, its transactions, the categories and the household's profiles don't
  // depend on each other, so fetch them together.
  const [{ data: cardData }, { data: txData }, { data: catData }, { data: profileRows }] =
    await Promise.all([
      supabase
        .from("cards")
        .select("id, owner_id, institution_name, account_name, last_four, account_type, is_private")
        .eq("id", cardId)
        .single(),
      txQuery,
      supabase.from("categories").select("id, name, icon, color").order("name"),
      coupleId
        ? supabase.from("profiles").select("id, display_name, email").eq("couple_id", coupleId)
        : Promise.resolve({ data: [] }),
    ]);

  if (!cardData) redirect("/accounts");

  // Resolve owner display name
  const card = cardData as AccountCardRow;
  let ownerName = "Mine";
  if (card.owner_id !== user.id) {
    const owner = (profileRows ?? []).find((p) => p.id === card.owner_id);
    ownerName = (owner?.display_name ?? owner?.email?.split("@")[0] ?? "Partner").split(" ")[0];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactions = (txData ?? []).map((tx: any) => ({ ...tx, splits: tx.splits ?? [] })) as TxRow[];
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
