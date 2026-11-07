/**
 * Applies one Plaid transactionsSync result set to the database.
 *
 * The important case is a pending transaction settling. Plaid retires the pending
 * ID (it shows up in `removed`) and issues a brand-new ID for the settled
 * transaction (it shows up in `added` with `pending_transaction_id` pointing back).
 * Deleting the pending row and inserting a fresh one used to wipe out everything the
 * user had done to it — `transaction_splits` is ON DELETE CASCADE, so splits
 * vanished with the pending row. Instead the pending row is *adopted* in place: it
 * keeps its row id (and so its splits, note and manual category) and simply takes on
 * the settled transaction's Plaid ID and numbers.
 *
 * This module has no runtime imports so it can be unit tested directly
 * (see scripts/sync.test.mjs).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export type PlaidTxLike = {
  transaction_id: string;
  pending_transaction_id?: string | null;
  account_id: string;
  merchant_name?: string | null;
  name?: string | null;
  amount: number;
  iso_currency_code?: string | null;
  date: string;
  pending: boolean;
  personal_finance_category?: { primary: string; detailed: string } | null;
};

export type SyncChanges = {
  added: PlaidTxLike[];
  modified: PlaidTxLike[];
  removed: { transaction_id: string }[];
};

export type ApplyParams = {
  coupleId: string;
  /** Plaid account id -> cards.id */
  accountToCard: Map<string, string>;
  /** Auto-assigned category id for a transaction, or null. */
  categorize: (tx: PlaidTxLike) => string | null;
};

type TxRow = {
  id: string;
  plaid_transaction_id: string;
  card_id: string | null;
  category_id: string | null;
  category_manually_set: boolean;
  is_transfer: boolean;
  amount: number;
  date: string;
  merchant_name: string | null;
  is_pending: boolean;
};

type SplitRow = { id: string; category_id: string | null; amount: number };
type SplitInput = { category_id: string | null; amount: number };

const TX_COLUMNS =
  "id, plaid_transaction_id, card_id, category_id, category_manually_set, is_transfer, amount, date, merchant_name, is_pending";

// Keep `.in()` lists short: a long list overflows the request URL and PostgREST
// silently returns nothing (this has bitten the splits query before).
const LOOKUP_CHUNK = 100;
const WRITE_CHUNK = 200;
const CONCURRENCY = 5;
// A settled transaction can post a few days after the pending one was authorized.
const MATCH_WINDOW_DAYS_BEFORE = 1;
const MATCH_WINDOW_DAYS_AFTER = 7;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function forEachConcurrent<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Scales split amounts so they add up to `newTotal`, using whole cents and the
 * largest-remainder method so the result sums exactly. Returns null when the splits
 * already match (or can't sensibly be rescaled).
 */
export function rescaleSplits(splits: SplitInput[], newTotal: number): SplitInput[] | null {
  if (splits.length === 0) return null;
  const oldCents = splits.map((s) => Math.round(s.amount * 100));
  const oldTotal = oldCents.reduce((a, b) => a + b, 0);
  const newTotalCents = Math.round(Math.abs(newTotal) * 100);
  if (oldTotal <= 0 || newTotalCents <= 0 || oldTotal === newTotalCents) return null;

  const raw = oldCents.map((c) => (c * newTotalCents) / oldTotal);
  const cents = raw.map((v) => Math.floor(v));
  let leftover = newTotalCents - cents.reduce((a, b) => a + b, 0);
  const byFraction = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; leftover > 0; k++, leftover--) cents[byFraction[k % byFraction.length].i] += 1;

  return splits
    .map((s, i) => ({ category_id: s.category_id, amount: cents[i] / 100 }))
    .filter((s) => s.amount > 0);
}

function normalizeName(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000);
}

async function fetchTxRows(
  supabase: AnySupabase,
  coupleId: string,
  plaidIds: string[]
): Promise<Map<string, TxRow>> {
  const rows = new Map<string, TxRow>();
  await forEachConcurrent(chunk(plaidIds, LOOKUP_CHUNK), CONCURRENCY, async (ids) => {
    const { data, error } = await supabase
      .from("transactions")
      .select(TX_COLUMNS)
      .eq("couple_id", coupleId)
      .in("plaid_transaction_id", ids);
    if (error) throw error;
    for (const r of (data ?? []) as TxRow[]) {
      rows.set(r.plaid_transaction_id, { ...r, amount: Number(r.amount) });
    }
  });
  return rows;
}

async function fetchSplits(
  supabase: AnySupabase,
  rowIds: string[]
): Promise<Map<string, SplitRow[]>> {
  const byRow = new Map<string, SplitRow[]>();
  await forEachConcurrent(chunk(rowIds, LOOKUP_CHUNK), CONCURRENCY, async (ids) => {
    const { data, error } = await supabase
      .from("transaction_splits")
      .select("id, transaction_id, category_id, amount")
      .in("transaction_id", ids);
    if (error) throw error;
    for (const s of (data ?? []) as (SplitRow & { transaction_id: string })[]) {
      const list = byRow.get(s.transaction_id) ?? [];
      list.push({ id: s.id, category_id: s.category_id, amount: Number(s.amount) });
      byRow.set(s.transaction_id, list);
    }
  });
  return byRow;
}

async function insertSplits(supabase: AnySupabase, rowId: string, splits: SplitInput[]) {
  if (splits.length === 0) return;
  const { error } = await supabase.from("transaction_splits").insert(
    splits.map((s) => ({ transaction_id: rowId, category_id: s.category_id, amount: s.amount }))
  );
  if (error) throw error;
}

// Rescales a row's existing splits to a new total. Inserts the new set before
// removing the old one so a failure part-way never leaves the row without splits.
// (transaction_splits has no UPDATE policy, so delete + insert is the only option.)
async function rescaleRowSplits(
  supabase: AnySupabase,
  rowId: string,
  current: SplitRow[],
  newTotal: number
) {
  const scaled = rescaleSplits(current, newTotal);
  if (!scaled) return;
  await insertSplits(supabase, rowId, scaled);
  const { error } = await supabase
    .from("transaction_splits")
    .delete()
    .in("id", current.map((s) => s.id));
  if (error) throw error;
}

export async function applySyncChanges(
  supabase: AnySupabase,
  { coupleId, accountToCard, categorize }: ApplyParams,
  changes: SyncChanges
): Promise<void> {
  // A transaction can appear in both `added` and `modified` in one run; the later entry wins.
  const incomingMap = new Map<string, PlaidTxLike>();
  for (const tx of [...changes.added, ...changes.modified]) incomingMap.set(tx.transaction_id, tx);
  const incoming = [...incomingMap.values()];
  const removedIds = [...new Set(changes.removed.map((r) => r.transaction_id))];
  if (incoming.length === 0 && removedIds.length === 0) return;

  // Look up only the rows this run can touch. (Loading every manually-categorized
  // row up front silently truncates at PostgREST's 1000-row cap.)
  const lookupIds = new Set<string>(removedIds);
  for (const tx of incoming) {
    lookupIds.add(tx.transaction_id);
    if (tx.pending_transaction_id) lookupIds.add(tx.pending_transaction_id);
  }
  const existing = await fetchTxRows(supabase, coupleId, [...lookupIds]);

  // ── Work out which pending row (if any) each incoming transaction replaces ──
  const pendingFor = new Map<string, TxRow>(); // incoming plaid id -> pending row it replaces
  const claimedRowIds = new Set<string>();

  for (const tx of incoming) {
    if (!tx.pending_transaction_id) continue;
    const row = existing.get(tx.pending_transaction_id);
    if (row && row.plaid_transaction_id !== tx.transaction_id) {
      pendingFor.set(tx.transaction_id, row);
      claimedRowIds.add(row.id);
    }
  }

  // Splits are only needed for rows we might migrate or whose total changed.
  const splitRowIds = new Set<string>();
  for (const row of pendingFor.values()) splitRowIds.add(row.id);
  for (const id of removedIds) {
    const row = existing.get(id);
    if (row && !claimedRowIds.has(row.id)) splitRowIds.add(row.id);
  }
  for (const tx of incoming) {
    const row = existing.get(tx.transaction_id);
    if (row && Math.abs(row.amount - tx.amount) > 0.005) splitRowIds.add(row.id);
  }
  const splits = await fetchSplits(supabase, [...splitRowIds]);

  const hasUserData = (row: TxRow) => row.category_manually_set || (splits.get(row.id)?.length ?? 0) > 0;

  // Some institutions never populate pending_transaction_id. For a pending row that
  // is going away *and* carries user edits, fall back to matching by card + merchant +
  // date — but only when the match is unambiguous in both directions.
  const orphans = removedIds
    .map((id) => existing.get(id))
    .filter((r): r is TxRow => !!r && r.is_pending && !claimedRowIds.has(r.id) && hasUserData(r));

  if (orphans.length > 0) {
    const txToOrphans = new Map<string, TxRow[]>();
    const orphanToTxs = new Map<string, string[]>();

    for (const tx of incoming) {
      if (tx.pending || tx.pending_transaction_id || existing.has(tx.transaction_id)) continue;
      const cardId = accountToCard.get(tx.account_id) ?? null;
      const name = normalizeName(tx.merchant_name ?? tx.name);
      if (!name) continue;

      let matches = orphans.filter((o) => {
        const gap = daysBetween(o.date, tx.date);
        return (
          o.card_id === cardId &&
          normalizeName(o.merchant_name) === name &&
          gap >= -MATCH_WINDOW_DAYS_BEFORE &&
          gap <= MATCH_WINDOW_DAYS_AFTER
        );
      });
      if (matches.length > 1) {
        const sameAmount = matches.filter((o) => Math.abs(o.amount - tx.amount) < 0.01);
        if (sameAmount.length > 0) matches = sameAmount;
      }
      txToOrphans.set(tx.transaction_id, matches);
      for (const m of matches) {
        orphanToTxs.set(m.id, [...(orphanToTxs.get(m.id) ?? []), tx.transaction_id]);
      }
    }

    for (const [txId, matches] of txToOrphans) {
      if (matches.length !== 1 || orphanToTxs.get(matches[0].id)?.length !== 1) continue;
      pendingFor.set(txId, matches[0]);
      claimedRowIds.add(matches[0].id);
    }
  }

  // ── Apply each incoming transaction ─────────────────────────────────────────
  const autoFields = (tx: PlaidTxLike) => {
    const primary = tx.personal_finance_category?.primary ?? "";
    const isTransferByCategory = ["LOAN_PAYMENTS", "TRANSFER_IN", "TRANSFER_OUT"].includes(primary);
    const autoCategory = isTransferByCategory ? null : categorize(tx);
    const isTransferByName =
      !isTransferByCategory && !autoCategory && /\bpayment\b/i.test(tx.merchant_name ?? tx.name ?? "");
    const isTransfer = isTransferByCategory || isTransferByName;
    return { category_id: isTransfer ? null : autoCategory, is_transfer: isTransfer };
  };

  const autoRows: Record<string, unknown>[] = [];
  const manualRows: Record<string, unknown>[] = [];

  for (const tx of incoming) {
    const plaidFields = {
      card_id: accountToCard.get(tx.account_id) ?? null,
      merchant_name: tx.merchant_name ?? tx.name,
      amount: tx.amount,
      currency: tx.iso_currency_code ?? "USD",
      date: tx.date,
      is_pending: tx.pending,
    };
    const row = existing.get(tx.transaction_id);
    const pending = pendingFor.get(tx.transaction_id);

    if (pending && !row) {
      // Settled version of a pending row: adopt the pending row in place.
      await rescaleRowSplits(supabase, pending.id, splits.get(pending.id) ?? [], tx.amount);
      const { error } = await supabase
        .from("transactions")
        .update({
          plaid_transaction_id: tx.transaction_id,
          ...plaidFields,
          ...(pending.category_manually_set ? {} : autoFields(tx)),
        })
        .eq("id", pending.id)
        .eq("couple_id", coupleId);
      if (error) throw error;
      continue;
    }

    if (pending && row) {
      // A row for the settled ID already exists (created before the link was known).
      // Carry the user's edits across, then drop the now-redundant pending row.
      if (!row.category_manually_set && hasUserData(pending)) {
        const scaled =
          rescaleSplits(splits.get(pending.id) ?? [], tx.amount) ??
          (splits.get(pending.id) ?? []).map((s) => ({ category_id: s.category_id, amount: s.amount }));
        await insertSplits(supabase, row.id, scaled);
        const { error } = await supabase
          .from("transactions")
          .update({
            ...plaidFields,
            category_id: pending.category_id,
            is_transfer: pending.is_transfer,
            category_manually_set: true,
          })
          .eq("id", row.id)
          .eq("couple_id", coupleId);
        if (error) throw error;
      } else if (row.category_manually_set) {
        await rescaleRowSplits(supabase, row.id, splits.get(row.id) ?? [], tx.amount);
        manualRows.push({ couple_id: coupleId, plaid_transaction_id: tx.transaction_id, ...plaidFields });
      } else {
        autoRows.push({
          couple_id: coupleId,
          plaid_transaction_id: tx.transaction_id,
          ...plaidFields,
          ...autoFields(tx),
        });
      }
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", pending.id)
        .eq("couple_id", coupleId);
      if (error) throw error;
      continue;
    }

    if (row?.category_manually_set) {
      // Never let Plaid overwrite what the user chose; just keep the amounts current.
      await rescaleRowSplits(supabase, row.id, splits.get(row.id) ?? [], tx.amount);
      manualRows.push({ couple_id: coupleId, plaid_transaction_id: tx.transaction_id, ...plaidFields });
    } else {
      autoRows.push({
        couple_id: coupleId,
        plaid_transaction_id: tx.transaction_id,
        ...plaidFields,
        ...autoFields(tx),
      });
    }
  }

  // Rows within a batch share the same columns, so a batch upsert can't blank out a
  // column that only some rows set (manual rows deliberately omit category fields).
  for (const rows of [autoRows, manualRows]) {
    for (const batch of chunk(rows, WRITE_CHUNK)) {
      const { error } = await supabase
        .from("transactions")
        .upsert(batch, { onConflict: "plaid_transaction_id" });
      if (!error) continue;

      // A single bad row shouldn't block the rest — retry individually and log.
      console.error("Batch upsert failed, retrying rows individually:", error);
      for (const one of batch) {
        const { error: rowError } = await supabase
          .from("transactions")
          .upsert(one, { onConflict: "plaid_transaction_id" });
        if (rowError) {
          console.error(`Upsert failed for ${one.plaid_transaction_id}:`, rowError);
        }
      }
    }
  }

  // ── Removals ────────────────────────────────────────────────────────────────
  // Pending rows that were adopted/merged above are skipped; everything else Plaid
  // retired (e.g. a cancelled pending charge) is deleted.
  const deletable = removedIds.filter((id) => {
    const row = existing.get(id);
    return !(row && claimedRowIds.has(row.id));
  });
  await forEachConcurrent(chunk(deletable, LOOKUP_CHUNK), CONCURRENCY, async (ids) => {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("couple_id", coupleId)
      .in("plaid_transaction_id", ids);
    if (error) throw error;
  });
}
