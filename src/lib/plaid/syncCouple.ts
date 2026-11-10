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
 *
 * `supabase` must be a client that can see EVERY card in the couple — the service-role
 * client. A client limited by row-level security can't see accounts hidden from its user,
 * so it can't match their transactions to a card (see syncScope.ts). User-triggered syncs
 * therefore go through syncCoupleForUser (syncForUser.ts), which passes the cards the user
 * may see as `visibleCardIds` so the sync stays within what they could already see.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

import { plaidClient } from "./client";
import { bestCategory } from "./categorize";
import { applySyncChanges, type PlaidTxLike } from "./applySyncChanges";
import { planItems, countReportable } from "./syncScope";

export async function syncCouple(
  supabase: AnySupabase,
  coupleId: string,
  options: {
    /**
     * Set for a user-triggered sync: only items that include one of these cards are
     * synced, and only these cards' activity is counted. Leave unset (cron) to sync
     * everything in the couple.
     */
    visibleCardIds?: ReadonlySet<string>;
  } = {}
): Promise<{ synced: number; errors: string[] }> {
  const { data: cards } = await supabase
    .from("cards")
    .select("id, plaid_item_id, plaid_access_token, plaid_account_id, plaid_sync_cursor")
    .eq("couple_id", coupleId)
    .not("plaid_access_token", "is", null);

  if (!cards?.length) return { synced: 0, errors: [] };

  // Group cards by Plaid item and, for a user-triggered sync, drop the items none of
  // whose accounts the user can see.
  const itemMap = planItems(cards, options.visibleCardIds);
  if (itemMap.size === 0) return { synced: 0, errors: [] };

  // This couple's categories only. The service-role client isn't limited by row-level
  // security, so without the filter other couples' custom categories would match too.
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .or(`is_default.eq.true,couple_id.eq.${coupleId}`);
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

      totalSynced += countReportable([...added, ...modified], accountToCard, options.visibleCardIds);
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
