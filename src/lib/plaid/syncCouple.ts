/**
 * Core per-couple sync logic — shared between the user-triggered route
 * and the background cron route.
 *
 * Uses Plaid's transactionsSync (cursor-based) instead of transactionsGet
 * so each run only fetches the delta since the last sync, not the full 90-day
 * window. The cursor is persisted on every card row for that Plaid item.
 * First sync (no cursor) fetches ~24 months of history; subsequent syncs
 * are incremental.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

import { plaidClient } from "./client";
import { bestCategory } from "./categorize";

export async function syncCouple(
  supabase: AnySupabase,
  coupleId: string
): Promise<{ synced: number; errors: string[] }> {
  const { data: cards } = await supabase
    .from("cards")
    .select("id, plaid_item_id, plaid_access_token, plaid_account_id, plaid_sync_cursor")
    .eq("couple_id", coupleId)
    .not("plaid_access_token", "is", null);

  if (!cards?.length) return { synced: 0, errors: [] };

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name");
  const categoryMap = new Map<string, string>();
  for (const cat of categories ?? []) {
    categoryMap.set((cat.name as string).toLowerCase(), cat.id as string);
  }

  const { data: manualRows } = await supabase
    .from("transactions")
    .select("plaid_transaction_id")
    .eq("couple_id", coupleId)
    .eq("category_manually_set", true)
    .not("plaid_transaction_id", "is", null);

  const manualIds = new Set<string>(
    (manualRows ?? []).map((r: { plaid_transaction_id: string }) => r.plaid_transaction_id)
  );

  // Group cards by Plaid item (one access token can cover multiple accounts).
  // The cursor is per item — read from the first card found for each item.
  const itemMap = new Map<
    string,
    { accessToken: string; accountToCard: Map<string, string>; cursor: string | null }
  >();
  for (const card of cards) {
    if (!card.plaid_item_id || !card.plaid_access_token) continue;
    if (!itemMap.has(card.plaid_item_id)) {
      itemMap.set(card.plaid_item_id, {
        accessToken: card.plaid_access_token,
        accountToCard: new Map(),
        cursor: card.plaid_sync_cursor ?? null,
      });
    }
    if (card.plaid_account_id) {
      itemMap.get(card.plaid_item_id)!.accountToCard.set(card.plaid_account_id, card.id);
    }
  }

  let totalSynced = 0;
  const errors: string[] = [];

  for (const [itemId, { accessToken, accountToCard, cursor }] of itemMap) {
    try {
      let nextCursor: string | undefined = cursor ?? undefined;
      let hasMore = true;
      let itemSynced = 0;

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: accessToken,
          ...(nextCursor ? { cursor: nextCursor } : {}),
          count: 500,
        });

        const { added, modified, removed, next_cursor, has_more } = response.data;

        for (const tx of [...added, ...modified]) {
          const cardId = accountToCard.get(tx.account_id) ?? null;
          const isManual = manualIds.has(tx.transaction_id);

          const plaidPrimary = tx.personal_finance_category?.primary ?? "";
          const isTransferByCategory = ["LOAN_PAYMENTS", "TRANSFER_IN", "TRANSFER_OUT"].includes(plaidPrimary);

          const autoCategory = isManual || isTransferByCategory
            ? null
            : bestCategory(
                {
                  merchant_name: tx.merchant_name ?? tx.name,
                  personal_finance_category: tx.personal_finance_category,
                },
                categoryMap
              );

          const isTransferByName =
            !isTransferByCategory &&
            !autoCategory &&
            /\bpayment\b/i.test(tx.merchant_name ?? tx.name ?? "");
          const isTransfer = isTransferByCategory || isTransferByName;

          const categoryField = isManual
            ? {}
            : { category_id: isTransfer ? null : autoCategory };

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
              is_transfer: isTransfer,
              ...categoryField,
            },
            { onConflict: "plaid_transaction_id" }
          );
        }

        // Plaid reports removed transactions explicitly (e.g. when a pending
        // transaction clears — it retires the pending ID and creates a new one).
        if (removed.length > 0) {
          const removedIds = removed.map((r: { transaction_id: string }) => r.transaction_id);
          await supabase
            .from("transactions")
            .delete()
            .eq("couple_id", coupleId)
            .in("plaid_transaction_id", removedIds);
        }

        itemSynced += added.length + modified.length;
        nextCursor = next_cursor;
        hasMore = has_more;
      }

      // Write the cursor to every card row for this item so the next sync
      // resumes from the right position regardless of which card is read first.
      await supabase
        .from("cards")
        .update({ plaid_sync_cursor: nextCursor })
        .eq("couple_id", coupleId)
        .eq("plaid_item_id", itemId);

      totalSynced += itemSynced;
    } catch (err) {
      console.error(`Sync failed for item ${itemId}:`, err);
      // Extract the human-readable message from a Plaid API error if present.
      // Plaid errors arrive as Axios response errors with a structured body.
      type PlaidErrBody = { display_message?: string; error_message?: string; error_code?: string };
      const body = (err as { response?: { data?: PlaidErrBody } })?.response?.data;
      const message =
        body?.display_message ||
        body?.error_message ||
        (body?.error_code ? `Plaid error: ${body.error_code}` : null) ||
        "Sync failed — check your connection";
      errors.push(message);
    }
  }

  await supabase
    .from("couples")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", coupleId);

  return { synced: totalSynced, errors };
}
