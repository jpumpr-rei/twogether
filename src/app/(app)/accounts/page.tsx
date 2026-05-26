import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AccountsClient, { type CardDisplay } from "./AccountsClient";

type CardRow = {
  id: string;
  owner_id: string;
  institution_name: string;
  account_name: string;
  last_four: string | null;
  account_type: string;
  is_private: boolean;
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
    const [{ data: cardData }, { data: profileData }] = await Promise.all([
      supabase
        .from("cards")
        .select("id, owner_id, institution_name, account_name, last_four, account_type, is_private")
        .eq("couple_id", coupleId)
        .eq("is_active", true)
        .order("institution_name"),
      supabase.from("profiles").select("id, display_name, email").eq("couple_id", coupleId),
    ]);

    const rawCards = (cardData ?? []) as CardRow[];

    for (const p of profileData ?? []) {
      const firstName = (p.display_name ?? p.email?.split("@")[0] ?? "Unknown").split(" ")[0];
      ownerNames[p.id] = firstName;
    }

    // Balances are fetched client-side via /api/plaid/balances to avoid
    // blocking page render on Plaid API latency.
    cards = rawCards.map((card) => ({
      id: card.id,
      owner_id: card.owner_id,
      institution_name: card.institution_name,
      account_name: card.account_name,
      last_four: card.last_four,
      account_type: card.account_type,
      is_private: card.is_private,
      balance_current: null,
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
