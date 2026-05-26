import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountDetailClient from "./AccountDetailClient";

export type AccountTxRow = {
  id: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  is_pending: boolean;
  category: { id: string; name: string; icon: string | null; color: string | null } | null;
};

export type AccountCardRow = {
  id: string;
  institution_name: string;
  account_name: string;
  last_four: string | null;
  account_type: string;
};

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cardData } = await supabase
    .from("cards")
    .select("id, institution_name, account_name, last_four, account_type")
    .eq("id", cardId)
    .single();

  if (!cardData) redirect("/accounts");

  const { data: txData } = await supabase
    .from("transactions")
    .select(
      "id, merchant_name, amount, date, is_pending, category:categories(id, name, icon, color)"
    )
    .eq("card_id", cardId)
    .order("date", { ascending: false })
    .limit(200);

  return (
    <AccountDetailClient
      card={cardData as AccountCardRow}
      transactions={(txData ?? []) as unknown as AccountTxRow[]}
    />
  );
}
