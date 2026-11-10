/**
 * Decides which Plaid items — and which of their transactions — a sync may touch and
 * report on. Pure, with no runtime imports, so it can be unit tested directly
 * (see scripts/sync-scope.test.mjs).
 *
 * Why this exists: a sync has to see EVERY account of a Plaid item. One access token
 * covers several accounts and Plaid returns transactions for all of them. If the syncing
 * user can't see one of those accounts (the holder hid it from them), its transactions
 * can't be matched to a card, and they used to be saved with no card at all — which
 * row-level security treats as visible to the whole household.
 *
 * So user-triggered syncs run with the service-role client (see syncForUser.ts), which
 * sees every card. This module keeps that from widening what a user can learn: they only
 * sync items they can already see part of, and only get a count for the accounts they
 * can see. Cron has no user, so it passes no `visibleCardIds` and syncs everything.
 */

/** A `cards` row, as far as syncing is concerned. */
export type SyncCard = {
  id: string;
  plaid_item_id: string | null;
  plaid_access_token: string | null;
  plaid_account_id: string | null;
  plaid_sync_cursor?: string | null;
};

/** One Plaid item (a bank login) and the accounts of it we hold cards for. */
export type SyncItem = {
  accessToken: string;
  /** Plaid account id -> cards.id */
  accountToCard: Map<string, string>;
  cursor: string | null;
};

/**
 * Groups a couple's cards by Plaid item (one access token can cover several accounts).
 * The cursor is per item — read from the first card found for each item.
 *
 * With `visibleCardIds`, only items that include at least one of those cards are kept.
 * A kept item still maps ALL of its accounts, hidden ones included, so every transaction
 * is filed under its own card. An item made up only of hidden accounts is dropped: syncing
 * it would reveal, through its result or its error, that the account exists.
 */
export function planItems(
  cards: SyncCard[],
  visibleCardIds?: ReadonlySet<string>
): Map<string, SyncItem> {
  const items = new Map<string, SyncItem>();
  const itemsTheViewerSees = new Set<string>();

  for (const card of cards) {
    if (!card.plaid_item_id || !card.plaid_access_token) continue;

    if (!items.has(card.plaid_item_id)) {
      items.set(card.plaid_item_id, {
        accessToken: card.plaid_access_token,
        accountToCard: new Map(),
        cursor: card.plaid_sync_cursor ?? null,
      });
    }
    if (card.plaid_account_id) {
      items.get(card.plaid_item_id)!.accountToCard.set(card.plaid_account_id, card.id);
    }
    if (visibleCardIds?.has(card.id)) itemsTheViewerSees.add(card.plaid_item_id);
  }

  if (!visibleCardIds) return items;
  return new Map([...items].filter(([itemId]) => itemsTheViewerSees.has(itemId)));
}

/**
 * How many changed transactions to report: all of them, or — when a viewer is given —
 * only those on accounts the viewer can see, so a hidden account's activity never shows
 * up in someone else's "N synced". Transactions on accounts we hold no card for are not
 * the viewer's to count.
 */
export function countReportable(
  txs: { account_id: string }[],
  accountToCard: Map<string, string>,
  visibleCardIds?: ReadonlySet<string>
): number {
  if (!visibleCardIds) return txs.length;

  let count = 0;
  for (const tx of txs) {
    const cardId = accountToCard.get(tx.account_id);
    if (cardId && visibleCardIds.has(cardId)) count++;
  }
  return count;
}
