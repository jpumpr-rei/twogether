/**
 * Core per-couple sync logic — shared between the user-triggered route
 * and the background cron route.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

import { plaidClient } from "./client";
import { bestCategory } from "./categorize";

export async function syncCouple(
  supabase: AnySupabase,
  coupleId: string
): Promise<{ synced: number; errors: string[] }> {
  // Fetch connected cards
  const { data: cards } = await supabase
    .from("cards")
    .select("id, plaid_item_id, plaid_access_token, plaid_account_id")
    .eq("couple_id", coupleId)
    .not("plaid_access_token", "is", null);

  if (!cards?.length) return { synced: 0, errors: [] };

  // Category name → id map for auto-categorisation
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name");
  const categoryMap = new Map<string, string>();
  for (const cat of categories ?? []) {
    categoryMap.set((cat.name as string).toLowerCase(), cat.id as string);
  }

  // Group cards by Plaid item (one access token can cover multiple accounts)
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

  // Fetch plaid_transaction_ids that were manually categorised so we never
  // overwrite the user's choice during sync.
  const { data: manualRows } = await supabase
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
      let offset = 0;
      let total = 1;
      // Track every plaid_transaction_id Plaid returns this sync so we can
      // clean up stale pending rows afterward.
      const seenPlaidIds = new Set<string>();

      while (offset < total) {
        const txResponse = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          options: { count: 500, offset },
        });

        total = txResponse.data.total_transactions;
        const txs = txResponse.data.transactions;

        for (const tx of txs) {
          seenPlaidIds.add(tx.transaction_id);
          const cardId = accountToCard.get(tx.account_id) ?? null;
          const isManual = manualIds.has(tx.transaction_id);
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
        if (txs.length === 0) break;
      }

      // Remove ghost pending rows: when a pending transaction clears, Plaid
      // retires its transaction_id and creates a new one for the settled record.
      // The old pending row never gets updated via upsert — it just silently
      // disappears from Plaid's responses. Deleting it here keeps the UI clean.
      // We only touch is_pending = true rows so settled history is never affected.
      if (seenPlaidIds.size > 0) {
        const cardIds = [...accountToCard.values()];
        const idList = [...seenPlaidIds].join(",");
        await supabase
          .from("transactions")
          .delete()
          .eq("couple_id", coupleId)
          .in("card_id", cardIds)
          .eq("is_pending", true)
          .not("plaid_transaction_id", "is", null)
          .not("plaid_transaction_id", "in", `(${idList})`);
      }
    } catch (err) {
      console.error(`Sync failed for item ${itemId}:`, err);
      errors.push(itemId);
    }
  }

  // Stamp the couple with the sync time
  await supabase
    .from("couples")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", coupleId);

  return { synced: totalSynced, errors };
}
