import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid/client";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .single();

  if (!profile?.couple_id) return NextResponse.json({ balances: {} });

  const { data: cards } = await supabase
    .from("cards")
    .select("id, plaid_item_id, plaid_account_id, plaid_access_token")
    .eq("couple_id", profile.couple_id)
    .eq("is_active", true);

  const balances: Record<string, number | null> = {};
  const seenItems = new Set<string>();

  // One Plaid call per unique item — run in parallel
  const itemTokens = new Map<string, string>();
  for (const card of cards ?? []) {
    if (card.plaid_access_token && card.plaid_item_id && !itemTokens.has(card.plaid_item_id)) {
      itemTokens.set(card.plaid_item_id, card.plaid_access_token);
    }
  }

  const results = await Promise.allSettled(
    Array.from(itemTokens.entries()).map(async ([, token]) => {
      const res = await plaidClient.accountsGet({ access_token: token });
      return res.data.accounts;
    })
  );

  // Build plaid_account_id → balance map
  const plaidBalanceMap = new Map<string, number | null>();
  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const acct of result.value) {
        plaidBalanceMap.set(acct.account_id, acct.balances.current ?? null);
      }
    }
  }

  // Map to our card IDs
  for (const card of cards ?? []) {
    if (card.plaid_account_id) {
      balances[card.id] = plaidBalanceMap.get(card.plaid_account_id) ?? null;
    }
    seenItems.add(card.id);
  }

  return NextResponse.json({ balances });
}
