// Tests for syncScope: which Plaid items a sync may touch, and what it may report.
// Run with: npm test   (uses Node's built-in test runner; Node 22+ runs the .ts directly)
//
// The case being guarded: a Plaid item holds a joint account and one the holder hid from
// their partner. When the partner syncs, the hidden account's transactions must still be
// filed under the hidden account's own card — never saved card-less, which every
// household member can see — and must not show up in the partner's results.
import test from "node:test";
import assert from "node:assert/strict";
import { planItems, countReportable } from "../src/lib/plaid/syncScope.ts";
import { applySyncChanges } from "../src/lib/plaid/applySyncChanges.ts";

const card = (id, item, account, over = {}) => ({
  id,
  plaid_item_id: item,
  plaid_account_id: account,
  plaid_access_token: item ? `token-${item}` : null,
  plaid_sync_cursor: null,
  ...over,
});

// Household layout used below:
//   item-1 (the holder's bank login): card-joint (visible to all) + card-hidden (holder only)
//   item-2 (the holder's other login): card-only-hidden (holder only)
//   item-3 (the partner's login):      card-partner (visible to all)
const CARDS = [
  card("card-joint", "item-1", "acct-joint", { plaid_sync_cursor: "cursor-1" }),
  card("card-hidden", "item-1", "acct-hidden", { plaid_sync_cursor: "stale-cursor" }),
  card("card-only-hidden", "item-2", "acct-only-hidden"),
  card("card-partner", "item-3", "acct-partner"),
];
const PARTNER_SEES = new Set(["card-joint", "card-partner"]);
const HOLDER_SEES = new Set(CARDS.map((c) => c.id));

test("without a viewer (cron) every item is planned", () => {
  const plan = planItems(CARDS);
  assert.deepEqual([...plan.keys()], ["item-1", "item-2", "item-3"]);
});

test("the accounts of one item are grouped, and the cursor comes from the first card", () => {
  const item = planItems(CARDS).get("item-1");
  assert.equal(item.accessToken, "token-item-1");
  assert.equal(item.cursor, "cursor-1");
  assert.deepEqual([...item.accountToCard], [
    ["acct-joint", "card-joint"],
    ["acct-hidden", "card-hidden"],
  ]);
});

test("cards with no Plaid item or access token are ignored", () => {
  const plan = planItems([
    card("manual", null, null),
    card("no-token", "item-x", "acct-x", { plaid_access_token: null }),
    card("real", "item-y", "acct-y"),
  ]);
  assert.deepEqual([...plan.keys()], ["item-y"]);
});

test("a viewer only gets items that include an account they can see", () => {
  const plan = planItems(CARDS, PARTNER_SEES);
  assert.deepEqual([...plan.keys()], ["item-1", "item-3"]);
});

test("an item made up only of hidden accounts is skipped entirely (no sync, so no count or error leaks)", () => {
  const plan = planItems(CARDS, PARTNER_SEES);
  assert.equal(plan.has("item-2"), false);
});

test("a partly hidden item is kept whole, so the hidden account still maps to its own card", () => {
  const item = planItems(CARDS, PARTNER_SEES).get("item-1");
  assert.equal(item.accountToCard.get("acct-hidden"), "card-hidden");
  assert.equal(item.accountToCard.get("acct-joint"), "card-joint");
});

test("the holder, who can see everything, gets every item", () => {
  assert.deepEqual([...planItems(CARDS, HOLDER_SEES).keys()], ["item-1", "item-2", "item-3"]);
});

test("a viewer who can see nothing gets nothing", () => {
  assert.equal(planItems(CARDS, new Set()).size, 0);
});

test("planning does not change the cards it is given", () => {
  const before = JSON.stringify(CARDS);
  planItems(CARDS, PARTNER_SEES);
  assert.equal(JSON.stringify(CARDS), before);
});

// ── countReportable ──────────────────────────────────────────────────────────
const ACCOUNT_TO_CARD = new Map([
  ["acct-joint", "card-joint"],
  ["acct-hidden", "card-hidden"],
]);
const TXS = [
  { account_id: "acct-joint" },
  { account_id: "acct-hidden" },
  { account_id: "acct-hidden" },
  { account_id: "acct-removed" }, // an account we hold no card for
];

test("with no viewer, every changed transaction is counted", () => {
  assert.equal(countReportable(TXS, ACCOUNT_TO_CARD), 4);
});

test("a viewer's count leaves out accounts hidden from them", () => {
  assert.equal(countReportable(TXS, ACCOUNT_TO_CARD, PARTNER_SEES), 1);
});

test("the holder's count includes their hidden account", () => {
  assert.equal(countReportable(TXS, ACCOUNT_TO_CARD, HOLDER_SEES), 3);
});

test("transactions on accounts we hold no card for are not a viewer's to count", () => {
  assert.equal(countReportable([{ account_id: "acct-removed" }], ACCOUNT_TO_CARD, HOLDER_SEES), 0);
  assert.equal(countReportable([], ACCOUNT_TO_CARD, PARTNER_SEES), 0);
});

// ── The planned map is what makes the sync file hidden transactions correctly ─
test("syncing a partly hidden item as the partner files the hidden account's transactions under its own card", async () => {
  const upserts = [];
  const supabase = {
    from() {
      const q = {
        select: () => q, eq: () => q, in: () => q, update: () => q, delete: () => q,
        insert: () => Promise.resolve({ error: null }),
        upsert: (rows) => { upserts.push(...[].concat(rows)); return Promise.resolve({ error: null }); },
        then: (res, rej) => Promise.resolve({ data: [], error: null }).then(res, rej),
      };
      return q;
    },
  };
  const tx = (id, account_id) => ({
    transaction_id: id, account_id, merchant_name: id, amount: 5, date: "2026-11-01", pending: false,
  });

  const { accountToCard } = planItems(CARDS, PARTNER_SEES).get("item-1");
  await applySyncChanges(
    supabase,
    { coupleId: "couple-1", accountToCard, categorize: () => null },
    { added: [tx("t-joint", "acct-joint"), tx("t-hidden", "acct-hidden")], modified: [], removed: [] }
  );

  const byId = Object.fromEntries(upserts.map((r) => [r.plaid_transaction_id, r.card_id]));
  assert.deepEqual(byId, { "t-joint": "card-joint", "t-hidden": "card-hidden" });
  assert.ok(upserts.every((r) => r.card_id !== null), "no transaction may be saved without a card");
});
