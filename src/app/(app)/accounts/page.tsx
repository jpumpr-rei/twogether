import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { plaidClient } from "@/lib/plaid/client";
import AccountsClient, { type CardDisplay } from "./AccountsClient";

type CardRow = {
  id: string;
  owner_id: string;
  institution_name: string;
  account_name: string;
  last_four: string | null;
  account_type: string;
  is_private: boolean;
  plaid_item_id: string | null;
  plaid_account_id: string | null;
  plaid_access_token: string | null;
};

export default async function AccountsPage() {
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

  let cards: CardDisplay[] = [];
  let ownerNames: Record<string, string> = {};

  if (coupleId) {
    const { data } = await supabase
      .from("cards")
      .select(
        "id, owner_id, institution_name, account_name, last_four, account_type, is_private, plaid_item_id, plaid_account_id, plaid_access_token"
      )
      .eq("couple_id", coupleId)
      .eq("is_active", true)
      .order("institution_name");

    const rawCards = (data ?? []) as CardRow[];

    // Fetch display names for all unique owners
    const ownerIds = [...new Set(rawCards.map((c) => c.owner_id))];
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ownerIds);
      for (const p of profiles ?? []) {
        const firstName = (p.display_name ?? p.email?.split("@")[0] ?? "Unknown").split(" ")[0];
        ownerNames[p.id] = firstName;
      }
    }

    // Fetch live balances from Plaid — one API call per unique item
    const balanceMap = new Map<string, number | null>();
    const seenItems = new Set<string>();

    for (const card of rawCards) {
      if (!card.plaid_access_token || !card.plaid_item_id) continue;
      if (seenItems.has(card.plaid_item_id)) continue;
      seenItems.add(card.plaid_item_id);
      try {
        const res = await plaidClient.accountsGet({ access_token: card.plaid_access_token });
        for (const acct of res.data.accounts) {
          balanceMap.set(acct.account_id, acct.balances.current ?? null);
        }
      } catch {
        // Token invalid or Plaid error — show card without balance
      }
    }

    cards = rawCards.map((card) => ({
      id: card.id,
      owner_id: card.owner_id,
      institution_name: card.institution_name,
      account_name: card.account_name,
      last_four: card.last_four,
      account_type: card.account_type,
      is_private: card.is_private,
      balance_current: card.plaid_account_id
        ? (balanceMap.get(card.plaid_account_id) ?? null)
        : null,
    }));
  }

  return (
    <div className="px-4 pt-12 pb-24">
      <AccountsClient
        initialCards={cards}
        currentUserId={user.id}
        ownerNames={ownerNames}
      />
    </div>
  );
}
