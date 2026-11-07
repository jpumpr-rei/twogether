/**
 * Core per-couple sync logic — shared between the user-triggered route
 * and the background cron route.
 *
 * Uses Plaid's transactionsSync (cursor-based) instead of transactionsGet
 * so each run only fetches the delta since the last sync, not the full 90-day
 * window. The cursor is persisted on every card row for that Plaid item.
 * First sync (no cursor) fetches ~24 months of history; subsequent syncs
 * are incremental.
 *
 * All pages for an item are collected first and applied together
 * (see applySyncChanges) so a pending transaction and the settled transaction
 * that replaces it are always handled in the same pass, even if Plaid paginates
 * them apart.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

import { plaidClient } from "./client";
import { bestCategory } from "./categorize";
import { applySyncChanges, type PlaidTxLike } from "./applySyncChanges";

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

  const categorize = (tx: PlaidTxLike) =>
    bestCategory(
      {
        merchant_name: tx.merchant_name ?? tx.name,
        personal_finance_category: tx.personal_finance_category,
      },
      categoryMap
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

      const added: PlaidTxLike[] = [];
      const modified: PlaidTxLike[] = [];
      const removed: { transaction_id: string }[] = [];

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: accessToken,
          ...(nextCursor ? { cursor: nextCursor } : {}),
          count: 500,
        });

        added.push(...response.data.added);
        modified.push(...response.data.modified);
        removed.push(...response.data.removed.map((r) => ({ transaction_id: r.transaction_id as string })));
        nextCursor = response.data.next_cursor;
        hasMore = response.data.has_more;
      }

      await applySyncChanges(
        supabase,
        { coupleId, accountToCard, categorize },
        { added, modified, removed }
      );

      // Write the cursor to every card row for this item so the next sync
      // resumes from the right position regardless of which card is read first.
      await supabase
        .from("cards")
        .update({ plaid_sync_cursor: nextCursor })
        .eq("couple_id", coupleId)
        .eq("plaid_item_id", itemId);

      totalSynced += added.length + modified.length;
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
