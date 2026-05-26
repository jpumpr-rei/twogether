import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid/client";
import { bestCategory } from "@/lib/plaid/categorize";

export async function POST() {
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

  if (!profile?.couple_id) {
    return NextResponse.json({ error: "No household found" }, { status: 400 });
  }

  const coupleId = profile.couple_id;

  // Get all connected cards with access tokens
  const { data: cards } = await supabase
    .from("cards")
    .select("id, plaid_item_id, plaid_access_token, plaid_account_id")
    .eq("couple_id", coupleId)
    .not("plaid_access_token", "is", null);

  if (!cards?.length) {
    return NextResponse.json({ synced: 0, message: "No connected accounts" });
  }

  // Get categories for auto-categorization
  const { data: categories } = await supabase.from("categories").select("id, name");
  const categoryMap = new Map<string, string>();
  for (const cat of categories ?? []) {
    categoryMap.set(cat.name.toLowerCase(), cat.id);
  }

  // Group cards by plaid_item_id (one access token serves multiple accounts)
  const itemMap = new Map<
    string,
    { accessToken: string; accountToCard: Map<string, string> }
  >();
  for (const card of cards) {
    if (!card.plaid_item_id || !card.plaid_access_token) continue;
    if (!itemMap.has(card.plaid_item_id)) {
      itemMap.set(card.plaid_item_id, {
        accessToken: card.plaid_access_token,
        accountToCard: new Map(),
      });
    }
    if (card.plaid_account_id) {
      itemMap.get(card.plaid_item_id)!.accountToCard.set(card.plaid_account_id, card.id);
    }
  }

  // Fetch plaid_transaction_ids that were manually categorized so sync
  // never overwrites the user's choice.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: manualRows } = await (supabase as any)
    .from("transactions")
    .select("plaid_transaction_id")
    .eq("couple_id", coupleId)
    .eq("category_manually_set", true)
    .not("plaid_transaction_id", "is", null);

  const manualIds = new Set<string>(
    (manualRows ?? []).map((r: { plaid_transaction_id: string }) => r.plaid_transaction_id)
  );

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  let totalSynced = 0;
  const errors: string[] = [];

  for (const [itemId, { accessToken, accountToCard }] of itemMap) {
    try {
      // Fetch up to 500 transactions per item (paginate if needed)
      let offset = 0;
      let fetched = 0;
      let total = 1; // start > 0 to enter loop

      while (offset < total) {
        const txResponse = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          options: { count: 500, offset },
        });

        total = txResponse.data.total_transactions;
        const txs = txResponse.data.transactions;
        fetched += txs.length;

        for (const tx of txs) {
          const cardId = accountToCard.get(tx.account_id) ?? null;
          const isManual = manualIds.has(tx.transaction_id);

          // Only auto-assign category for transactions the user hasn't
          // manually categorized — preserves their overrides across syncs.
          const categoryId = isManual
            ? undefined
            : bestCategory(
                {
                  merchant_name: tx.merchant_name ?? tx.name,
                  personal_finance_category: tx.personal_finance_category,
                },
                categoryMap
              );

          await supabase.from("transactions").upsert(
            {
              couple_id: coupleId,
              card_id: cardId,
              plaid_transaction_id: tx.transaction_id,
              merchant_name: tx.merchant_name ?? tx.name,
              amount: tx.amount,
              currency: tx.iso_currency_code ?? "USD",
              date: tx.date,
              is_pending: tx.pending,
              ...(categoryId !== undefined && { category_id: categoryId }),
            },
            { onConflict: "plaid_transaction_id" }
          );
        }

        totalSynced += txs.length;
        offset += txs.length;

        // Safety: stop if Plaid returns empty batch
        if (txs.length === 0) break;
      }
    } catch (err) {
      console.error(`Sync failed for item ${itemId}:`, err);
      errors.push(itemId);
    }
  }

  return NextResponse.json({
    synced: totalSynced,
    errors: errors.length > 0 ? errors : undefined,
  });
}
