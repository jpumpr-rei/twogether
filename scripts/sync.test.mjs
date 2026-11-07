// Regression tests for applySyncChanges (pending -> settled transaction handling).
// Run with: npm test   (uses Node's built-in test runner; Node 22+ runs the .ts directly)
import test from "node:test";
import assert from "node:assert/strict";
import { applySyncChanges, rescaleSplits } from "../src/lib/plaid/applySyncChanges.ts";

// ── In-memory stand-in for the Supabase client ───────────────────────────────
// Mirrors the production behaviours that matter here:
//   • deleting a transaction cascades to its splits (ON DELETE CASCADE)
//   • plaid_transaction_id is unique
//   • selects are capped at 1000 rows (PostgREST default max-rows)
//   • transaction_splits has no UPDATE policy, so any update on it is a bug
class FakeDb {
  constructor() {
    this.tables = { transactions: [], transaction_splits: [] };
    this.seq = 0;
  }
  nextId(prefix) {
    return `${prefix}-${++this.seq}`;
  }
  from(table) {
    return new Query(this, table);
  }
}

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.op = "select";
  }
  select() { return this; }
  eq(col, val) { this.filters.push((r) => r[col] === val); return this; }
  in(col, vals) { this.filters.push((r) => vals.includes(r[col])); return this; }
  insert(rows) { this.op = "insert"; this.payload = rows; return this; }
  upsert(rows, opts) { this.op = "upsert"; this.payload = rows; this.opts = opts; return this; }
  update(obj) { this.op = "update"; this.payload = obj; return this; }
  delete() { this.op = "delete"; return this; }
  then(resolve, reject) {
    try { resolve(this.exec()); } catch (e) { reject(e); }
  }

  matches() {
    return this.db.tables[this.table].filter((r) => this.filters.every((f) => f(r)));
  }

  uniqueViolation(col, value, exceptId) {
    return (
      this.table === "transactions" &&
      col === "plaid_transaction_id" &&
      this.db.tables.transactions.some((r) => r.plaid_transaction_id === value && r.id !== exceptId)
    );
  }

  insertRow(row) {
    const rows = this.db.tables[this.table];
    const defaults =
      this.table === "transactions"
        ? { category_id: null, category_manually_set: false, is_transfer: false, note: null }
        : {};
    const full = { id: this.db.nextId(this.table === "transactions" ? "tx" : "split"), ...defaults, ...row };
    rows.push(full);
    return full;
  }

  exec() {
    const rows = this.db.tables[this.table];

    if (this.op === "select") {
      return { data: this.matches().slice(0, 1000).map((r) => ({ ...r })), error: null };
    }

    if (this.op === "insert") {
      for (const row of [].concat(this.payload)) {
        if (this.uniqueViolation("plaid_transaction_id", row.plaid_transaction_id)) {
          return { data: null, error: { code: "23505", message: "duplicate plaid_transaction_id" } };
        }
        this.insertRow(row);
      }
      return { data: null, error: null };
    }

    if (this.op === "upsert") {
      const col = this.opts.onConflict;
      const seen = new Set();
      for (const row of [].concat(this.payload)) {
        assert.ok(!seen.has(row[col]), "duplicate conflict key inside one upsert batch");
        seen.add(row[col]);
        const found = rows.find((r) => r[col] === row[col]);
        if (found) Object.assign(found, row);
        else this.insertRow(row);
      }
      return { data: null, error: null };
    }

    if (this.op === "update") {
      assert.notEqual(this.table, "transaction_splits", "transaction_splits has no UPDATE policy");
      const targets = this.matches();
      if ("plaid_transaction_id" in this.payload) {
        for (const t of targets) {
          if (this.uniqueViolation("plaid_transaction_id", this.payload.plaid_transaction_id, t.id)) {
            return { data: null, error: { code: "23505", message: "duplicate plaid_transaction_id" } };
          }
        }
      }
      for (const t of targets) Object.assign(t, this.payload);
      return { data: null, error: null };
    }

    if (this.op === "delete") {
      const doomed = new Set(this.matches().map((r) => r.id));
      this.db.tables[this.table] = rows.filter((r) => !doomed.has(r.id));
      if (this.table === "transactions") {
        this.db.tables.transaction_splits = this.db.tables.transaction_splits.filter(
          (s) => !doomed.has(s.transaction_id)
        );
      }
      return { data: null, error: null };
    }
    throw new Error(`unsupported op ${this.op}`);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const COUPLE = "couple-1";
const params = {
  coupleId: COUPLE,
  accountToCard: new Map([["acct-1", "card-1"]]),
  categorize: () => "cat-auto",
};

function seedTx(db, over = {}) {
  const row = {
    id: db.nextId("tx"),
    couple_id: COUPLE,
    card_id: "card-1",
    category_id: null,
    plaid_transaction_id: null,
    merchant_name: "Cafe",
    amount: 50,
    currency: "USD",
    date: "2026-10-01",
    is_pending: true,
    is_transfer: false,
    category_manually_set: false,
    note: null,
    ...over,
  };
  db.tables.transactions.push(row);
  return row;
}

function seedSplits(db, txId, splits) {
  for (const s of splits) {
    db.tables.transaction_splits.push({ id: db.nextId("split"), transaction_id: txId, ...s });
  }
}

function plaidTx(over = {}) {
  return {
    transaction_id: "t1",
    pending_transaction_id: null,
    account_id: "acct-1",
    merchant_name: "Cafe",
    name: "CAFE",
    amount: 50,
    iso_currency_code: "USD",
    date: "2026-10-01",
    pending: false,
    personal_finance_category: null,
    ...over,
  };
}

const splitsOf = (db, txId) =>
  db.tables.transaction_splits
    .filter((s) => s.transaction_id === txId)
    .map((s) => ({ category_id: s.category_id, amount: s.amount }))
    .sort((a, b) => a.amount - b.amount);

// Like the real categorizer, nothing matches a card-payment merchant.
const realisticParams = {
  ...params,
  categorize: (tx) => (/payment/i.test(tx.merchant_name ?? "") ? null : "cat-auto"),
};

const sync = (db, changes) =>
  applySyncChanges(db, realisticParams, { added: [], modified: [], removed: [], ...changes });

// ── Splits survive settling ──────────────────────────────────────────────────
test("splits made while pending survive when the transaction settles", async () => {
  const db = new FakeDb();
  const pending = seedTx(db, { plaid_transaction_id: "p1", category_manually_set: true });
  seedSplits(db, pending.id, [
    { category_id: "groceries", amount: 30 },
    { category_id: "gas", amount: 20 },
  ]);

  await sync(db, {
    added: [plaidTx({ transaction_id: "t1", pending_transaction_id: "p1" })],
    removed: [{ transaction_id: "p1" }],
  });

  assert.equal(db.tables.transactions.length, 1);
  const row = db.tables.transactions[0];
  assert.equal(row.id, pending.id, "row identity is preserved");
  assert.equal(row.plaid_transaction_id, "t1");
  assert.equal(row.is_pending, false);
  assert.equal(row.category_manually_set, true);
  assert.equal(row.category_id, null);
  assert.deepEqual(splitsOf(db, row.id), [
    { category_id: "gas", amount: 20 },
    { category_id: "groceries", amount: 30 },
  ]);
});

test("splits are rescaled proportionally when the settled amount differs (e.g. a tip)", async () => {
  const db = new FakeDb();
  const pending = seedTx(db, { plaid_transaction_id: "p1", category_manually_set: true });
  seedSplits(db, pending.id, [
    { category_id: "groceries", amount: 30 },
    { category_id: "gas", amount: 20 },
  ]);

  await sync(db, {
    added: [plaidTx({ transaction_id: "t1", pending_transaction_id: "p1", amount: 60 })],
    removed: [{ transaction_id: "p1" }],
  });

  const row = db.tables.transactions[0];
  assert.equal(row.amount, 60);
  const result = splitsOf(db, row.id);
  assert.deepEqual(result, [
    { category_id: "gas", amount: 24 },
    { category_id: "groceries", amount: 36 },
  ]);
});

test("a settled amount that changes a manual posted row rescales its splits too", async () => {
  const db = new FakeDb();
  const row = seedTx(db, { plaid_transaction_id: "t1", is_pending: false, category_manually_set: true });
  seedSplits(db, row.id, [
    { category_id: "a", amount: 25 },
    { category_id: "b", amount: 25 },
  ]);

  await sync(db, { modified: [plaidTx({ transaction_id: "t1", amount: 40 })] });

  assert.equal(db.tables.transactions[0].amount, 40);
  assert.deepEqual(splitsOf(db, row.id), [
    { category_id: "a", amount: 20 },
    { category_id: "b", amount: 20 },
  ]);
});

// ── Single manual category survives settling ─────────────────────────────────
test("a manually chosen category survives settling (and is not overwritten by auto-categorization)", async () => {
  const db = new FakeDb();
  seedTx(db, { plaid_transaction_id: "p1", category_manually_set: true, category_id: "dining" });

  await sync(db, {
    added: [plaidTx({ transaction_id: "t1", pending_transaction_id: "p1" })],
    removed: [{ transaction_id: "p1" }],
  });

  assert.equal(db.tables.transactions.length, 1);
  assert.equal(db.tables.transactions[0].category_id, "dining");
  assert.equal(db.tables.transactions[0].category_manually_set, true);
});

test("a 'payment' flag set by the user survives settling", async () => {
  const db = new FakeDb();
  seedTx(db, { plaid_transaction_id: "p1", category_manually_set: true, is_transfer: true });

  await sync(db, {
    added: [plaidTx({ transaction_id: "t1", pending_transaction_id: "p1" })],
    removed: [{ transaction_id: "p1" }],
  });

  assert.equal(db.tables.transactions[0].is_transfer, true);
  assert.equal(db.tables.transactions[0].category_id, null);
});

test("an untouched pending transaction gets the auto category when it settles", async () => {
  const db = new FakeDb();
  seedTx(db, { plaid_transaction_id: "p1", category_id: "old-auto" });

  await sync(db, {
    added: [plaidTx({ transaction_id: "t1", pending_transaction_id: "p1" })],
    removed: [{ transaction_id: "p1" }],
  });

  assert.equal(db.tables.transactions.length, 1);
  assert.equal(db.tables.transactions[0].category_id, "cat-auto");
  assert.equal(db.tables.transactions[0].category_manually_set, false);
});

// ── The 1000-row cap that used to drop manual categories ─────────────────────
test("manual categories are preserved even with more than 1000 other manual rows", async () => {
  const db = new FakeDb();
  for (let i = 0; i < 1500; i++) {
    seedTx(db, {
      plaid_transaction_id: `m${i}`,
      is_pending: false,
      category_manually_set: true,
      category_id: "dining",
    });
  }
  const pending = seedTx(db, { plaid_transaction_id: "p1", category_manually_set: true, category_id: "travel" });
  const posted = seedTx(db, { plaid_transaction_id: "t9", is_pending: false, category_manually_set: true, category_id: "gifts" });

  await sync(db, {
    added: [plaidTx({ transaction_id: "t1", pending_transaction_id: "p1" })],
    modified: [plaidTx({ transaction_id: "t9" })],
    removed: [{ transaction_id: "p1" }],
  });

  assert.equal(db.tables.transactions.find((r) => r.id === pending.id).category_id, "travel");
  assert.equal(db.tables.transactions.find((r) => r.id === posted.id).category_id, "gifts");
});

// ── Banks that don't send pending_transaction_id ─────────────────────────────
test("falls back to matching card + merchant + date when Plaid sends no pending link", async () => {
  const db = new FakeDb();
  const pending = seedTx(db, { plaid_transaction_id: "p1", category_manually_set: true, category_id: "dining" });
  seedSplits(db, pending.id, [
    { category_id: "dining", amount: 30 },
    { category_id: "gifts", amount: 20 },
  ]);

  await sync(db, {
    added: [plaidTx({ transaction_id: "t1", pending_transaction_id: null, date: "2026-10-02" })],
    removed: [{ transaction_id: "p1" }],
  });

  assert.equal(db.tables.transactions.length, 1);
  assert.equal(db.tables.transactions[0].id, pending.id);
  assert.equal(db.tables.transactions[0].plaid_transaction_id, "t1");
  assert.equal(splitsOf(db, pending.id).length, 2);
});

test("an ambiguous fallback match is not guessed", async () => {
  const db = new FakeDb();
  seedTx(db, { plaid_transaction_id: "p1", category_manually_set: true, category_id: "dining" });
  seedTx(db, { plaid_transaction_id: "p2", category_manually_set: true, category_id: "gifts" });

  await sync(db, {
    added: [plaidTx({ transaction_id: "t1", pending_transaction_id: null })],
    removed: [{ transaction_id: "p1" }, { transaction_id: "p2" }],
  });

  assert.equal(db.tables.transactions.length, 1);
  assert.equal(db.tables.transactions[0].plaid_transaction_id, "t1");
  assert.equal(db.tables.transactions[0].category_id, "cat-auto");
});

test("the fallback never matches a different merchant or card", async () => {
  const db = new FakeDb();
  seedTx(db, { plaid_transaction_id: "p1", category_manually_set: true, category_id: "dining", merchant_name: "Other Place" });

  await sync(db, {
    added: [plaidTx({ transaction_id: "t1" })],
    removed: [{ transaction_id: "p1" }],
  });

  assert.equal(db.tables.transactions.length, 1);
  assert.equal(db.tables.transactions[0].category_id, "cat-auto");
});

// ── Everything else keeps working ────────────────────────────────────────────
test("a cancelled pending charge with no replacement is deleted, splits and all", async () => {
  const db = new FakeDb();
  const pending = seedTx(db, { plaid_transaction_id: "p1", category_manually_set: true });
  seedSplits(db, pending.id, [{ category_id: "a", amount: 50 }]);

  await sync(db, { removed: [{ transaction_id: "p1" }] });

  assert.equal(db.tables.transactions.length, 0);
  assert.equal(db.tables.transaction_splits.length, 0);
});

test("when both the pending row and a settled row exist, the user's splits move to the settled row", async () => {
  const db = new FakeDb();
  const pending = seedTx(db, { plaid_transaction_id: "p1", category_manually_set: true });
  seedSplits(db, pending.id, [
    { category_id: "a", amount: 30 },
    { category_id: "b", amount: 20 },
  ]);
  const settled = seedTx(db, { plaid_transaction_id: "t1", is_pending: false, category_id: "cat-auto" });

  await sync(db, {
    added: [plaidTx({ transaction_id: "t1", pending_transaction_id: "p1" })],
    removed: [{ transaction_id: "p1" }],
  });

  assert.equal(db.tables.transactions.length, 1);
  const row = db.tables.transactions[0];
  assert.equal(row.id, settled.id);
  assert.equal(row.category_manually_set, true);
  assert.equal(row.category_id, null);
  assert.deepEqual(splitsOf(db, settled.id), [
    { category_id: "b", amount: 20 },
    { category_id: "a", amount: 30 },
  ]);
});

test("new transactions are auto-categorized, payments are detected, and manual rows in the same batch are untouched", async () => {
  const db = new FakeDb();
  seedTx(db, { plaid_transaction_id: "m1", is_pending: false, category_manually_set: true, category_id: "dining" });

  await sync(db, {
    added: [
      plaidTx({ transaction_id: "n1", merchant_name: "Shop", name: "SHOP" }),
      plaidTx({ transaction_id: "n2", merchant_name: "Card Payment", name: "CARD PAYMENT" }),
      plaidTx({ transaction_id: "n3", personal_finance_category: { primary: "TRANSFER_OUT", detailed: "X" } }),
    ],
    modified: [plaidTx({ transaction_id: "m1", amount: 12 })],
  });

  const byPlaid = Object.fromEntries(db.tables.transactions.map((r) => [r.plaid_transaction_id, r]));
  assert.equal(byPlaid.m1.category_id, "dining");
  assert.equal(byPlaid.m1.amount, 12);
  assert.equal(byPlaid.n1.category_id, "cat-auto");
  assert.equal(byPlaid.n1.is_transfer, false);
  assert.equal(byPlaid.n2.is_transfer, true);
  assert.equal(byPlaid.n2.category_id, null);
  assert.equal(byPlaid.n3.is_transfer, true);
});

test("applying the same changes twice leaves the same result", async () => {
  const db = new FakeDb();
  const pending = seedTx(db, { plaid_transaction_id: "p1", category_manually_set: true });
  seedSplits(db, pending.id, [
    { category_id: "a", amount: 30 },
    { category_id: "b", amount: 20 },
  ]);
  const changes = {
    added: [plaidTx({ transaction_id: "t1", pending_transaction_id: "p1", amount: 60 })],
    removed: [{ transaction_id: "p1" }],
  };

  await sync(db, changes);
  const afterFirst = JSON.stringify([db.tables.transactions, splitsOf(db, pending.id)]);
  await sync(db, changes);
  const afterSecond = JSON.stringify([db.tables.transactions, splitsOf(db, pending.id)]);

  assert.equal(afterSecond, afterFirst);
});

test("another couple's rows are never touched", async () => {
  const db = new FakeDb();
  const theirs = seedTx(db, { couple_id: "couple-2", plaid_transaction_id: "p1", category_manually_set: true, category_id: "x" });

  await sync(db, { removed: [{ transaction_id: "p1" }] });

  assert.equal(db.tables.transactions.length, 1);
  assert.equal(db.tables.transactions[0].id, theirs.id);
});

// ── rescaleSplits ────────────────────────────────────────────────────────────
test("rescaleSplits always sums exactly to the new total", () => {
  const out = rescaleSplits(
    [
      { category_id: "a", amount: 10 },
      { category_id: "b", amount: 10 },
      { category_id: "c", amount: 10 },
    ],
    100
  );
  const cents = out.reduce((s, x) => s + Math.round(x.amount * 100), 0);
  assert.equal(cents, 10000);
});

test("rescaleSplits returns null when nothing needs to change", () => {
  assert.equal(rescaleSplits([{ category_id: "a", amount: 50 }], 50), null);
  assert.equal(rescaleSplits([], 50), null);
});

test("rescaleSplits handles credits (negative transaction amounts) by total magnitude", () => {
  const out = rescaleSplits(
    [
      { category_id: "a", amount: 10 },
      { category_id: "b", amount: 10 },
    ],
    -30
  );
  assert.deepEqual(out, [
    { category_id: "a", amount: 15 },
    { category_id: "b", amount: 15 },
  ]);
});
