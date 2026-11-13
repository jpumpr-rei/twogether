import test from "node:test";
import assert from "node:assert/strict";
import {
  monthlyAmount,
  ownerOf,
  filterByLens,
  categorySpend,
  categoryShares,
  daysLeftInMonth,
  computeHero,
  budgetCards,
} from "../src/lib/home/metrics.ts";
import { parseLens } from "../src/lib/home/types.ts";
import {
  assignHues,
  glassFills,
  mosaicFills,
  trianglePoints,
  TRIANGLE_COUNT,
  RAMPS,
  GLASS_LAYOUT,
  MOSAIC_LAYOUT,
} from "../src/lib/brand/palette.ts";

const people = { me: "sam", partner: "alex" };
const cardOwners = { c1: "sam", c2: "alex" };

const rows = [
  { amount: 100, category_id: "groceries", card_id: "c1", splits: null },
  { amount: 60, category_id: "groceries", card_id: "c2", splits: null },
  { amount: 20, category_id: "groceries", card_id: null, splits: null }, // entered by hand
  { amount: 40, category_id: "dining", card_id: "c2", splits: null },
  { amount: -10, category_id: "groceries", card_id: "c1", splits: null }, // refund
  // a split transaction has no category of its own; its portions carry the categories
  { amount: 50, category_id: null, card_id: "c1", splits: [
    { category_id: "dining", amount: 30 },
    { category_id: "groceries", amount: 20 },
  ] },
  // an uncategorised purchase and a payment between own accounts are not category spending
  { amount: 500, category_id: null, card_id: "c1", splits: null },
];

const budgets = [
  { category_id: "groceries", amount: 300, period: "monthly" },
  { category_id: "dining", amount: 100, period: "monthly" },
  { category_id: null, amount: 999, period: "monthly" }, // no category: ignored
];

test("monthlyAmount normalises weekly and yearly budgets", () => {
  assert.equal(monthlyAmount({ amount: 120, period: "yearly" }), 10);
  assert.equal(monthlyAmount({ amount: 12, period: "weekly" }), 52);
  assert.equal(monthlyAmount({ amount: 300, period: "monthly" }), 300);
});

test("ownerOf follows the card; hand-entered items have no owner", () => {
  assert.equal(ownerOf({ card_id: "c1" }, cardOwners), "sam");
  assert.equal(ownerOf({ card_id: null }, cardOwners), null);
  assert.equal(ownerOf({ card_id: "gone" }, cardOwners), null);
});

test("lens filters by card holder; Ours shows everything", () => {
  assert.equal(filterByLens(rows, "ours", people, cardOwners).length, rows.length);
  assert.ok(filterByLens(rows, "mine", people, cardOwners).every((r) => r.card_id === "c1"));
  assert.ok(filterByLens(rows, "theirs", people, cardOwners).every((r) => r.card_id === "c2"));
});

test("Theirs is empty when there is no partner", () => {
  assert.deepEqual(filterByLens(rows, "theirs", { me: "sam", partner: null }, cardOwners), []);
});

test("categorySpend counts categorised amounts in full and positive split portions", () => {
  const spend = categorySpend(rows);
  // 100 + 60 + 20 - 10 + 20 (split portion)
  assert.equal(spend.get("groceries"), 190);
  // 40 + 30 (split portion)
  assert.equal(spend.get("dining"), 70);
  assert.equal(spend.size, 2);
});

test("a negative split portion is not counted", () => {
  const spend = categorySpend([
    { amount: -20, category_id: null, card_id: null, splits: [{ category_id: "x", amount: -20 }] },
  ]);
  assert.equal(spend.get("x"), undefined);
});

test("categoryShares splits spending by whose card it went on", () => {
  const s = categoryShares(rows, cardOwners, people).get("groceries");
  assert.deepEqual(s, { mine: 100 - 10 + 20, theirs: 60, shared: 20 });
});

test("hero (Ours) shows what is left of the budgets", () => {
  const hero = computeHero({ rows, budgets, lens: "ours", people, cardOwners, daysLeft: 10 });
  // budgeted 400, spent 190 + 70 = 260
  assert.equal(hero.kind, "left");
  assert.equal(hero.amount, 140);
  assert.equal(hero.perDay, 14);
  assert.equal(hero.budgeted, 400);
});

test("hero (Ours) shows how far over when the budgets are exceeded", () => {
  const hero = computeHero({
    rows,
    budgets: [{ category_id: "groceries", amount: 100, period: "monthly" }],
    lens: "ours", people, cardOwners, daysLeft: 5,
  });
  assert.equal(hero.kind, "over");
  assert.equal(hero.amount, 90);
});

test("hero falls back to spending when there are no budgets", () => {
  const hero = computeHero({ rows, budgets: [], lens: "ours", people, cardOwners, daysLeft: 5 });
  assert.equal(hero.kind, "spent");
  assert.equal(hero.hasBudgets, false);
  assert.equal(hero.amount, 260);
  assert.equal(hero.sharePct, null);
});

test("hero (Mine and Theirs) shows that person's spending and their share", () => {
  const mine = computeHero({ rows, budgets, lens: "mine", people, cardOwners, daysLeft: 5 });
  const theirs = computeHero({ rows, budgets, lens: "theirs", people, cardOwners, daysLeft: 5 });
  assert.equal(mine.kind, "spent");
  assert.equal(mine.amount, 100 - 10 + 30 + 20);
  assert.equal(theirs.amount, 60 + 40);
  assert.equal(mine.sharePct + theirs.sharePct <= 100, true);
});

test("budget cards rank by how close the household is to the limit", () => {
  const cards = budgetCards({ rows, budgets, lens: "ours", people, cardOwners });
  // dining 70 of 100 = 70%, groceries 190 of 300 = 63%
  assert.deepEqual(cards.map((c) => c.categoryId), ["dining", "groceries"]);
  assert.equal(cards[0].pct, 0.7);
  assert.equal(cards[0].over, 0);
});

test("budget cards report the lens' own spending but rank by the household's", () => {
  const cards = budgetCards({ rows, budgets, lens: "mine", people, cardOwners });
  const groceries = cards.find((c) => c.categoryId === "groceries");
  assert.equal(groceries.lensSpent, 100 - 10 + 20);
  assert.equal(groceries.householdSpent, 190);
});

test("budget cards honour the limit and skip zero budgets", () => {
  const many = Array.from({ length: 6 }, (_, i) => ({ category_id: `c${i}`, amount: 100, period: "monthly" }));
  assert.equal(budgetCards({ rows: [], budgets: many, lens: "ours", people, cardOwners }).length, 3);
  assert.equal(
    budgetCards({ rows, budgets: [{ category_id: "groceries", amount: 0, period: "monthly" }], lens: "ours", people, cardOwners }).length,
    0
  );
});

test("daysLeftInMonth counts today", () => {
  assert.equal(daysLeftInMonth(new Date(2026, 10, 12)), 19); // 12 Nov: 12..30
  assert.equal(daysLeftInMonth(new Date(2026, 1, 28)), 1); // last day of Feb 2026
  assert.equal(daysLeftInMonth(new Date(2028, 1, 1)), 29); // leap year
});

test("parseLens only accepts the three lenses", () => {
  assert.equal(parseLens("mine"), "mine");
  assert.equal(parseLens("theirs"), "theirs");
  assert.equal(parseLens("ours"), "ours");
  assert.equal(parseLens("nonsense"), "ours");
  assert.equal(parseLens(undefined), "ours");
});

test("hues: the earlier account is persimmon, the later ultramarine, in any input order", () => {
  const a = { id: "z-sam", createdAt: "2026-05-25T10:00:00Z" };
  const b = { id: "a-alex", createdAt: "2026-05-26T10:00:00Z" };
  assert.deepEqual(assignHues([a, b]), { "z-sam": "persimmon", "a-alex": "ultramarine" });
  assert.deepEqual(assignHues([b, a]), { "z-sam": "persimmon", "a-alex": "ultramarine" });
});

test("hues: ties on creation time break by id, and a lone member is persimmon", () => {
  const t = "2026-05-25T10:00:00Z";
  assert.deepEqual(assignHues([{ id: "b", createdAt: t }, { id: "a", createdAt: t }]), {
    a: "persimmon",
    b: "ultramarine",
  });
  assert.deepEqual(assignHues([{ id: "solo", createdAt: t }]), { solo: "persimmon" });
});

test("glass: one fill per triangle, every fill defined, and the lit steps come from the ramp", () => {
  assert.equal(GLASS_LAYOUT.length, TRIANGLE_COUNT);
  assert.equal(MOSAIC_LAYOUT.length, TRIANGLE_COUNT);
  for (const ramp of Object.values(RAMPS)) {
    const fills = glassFills(ramp);
    assert.equal(fills.length, TRIANGLE_COUNT);
    assert.ok(fills.every((f) => /^#[0-9A-Fa-f]{6}$/.test(f)));
    for (const step of ramp) assert.ok(fills.includes(step), `ramp step ${step} is used`);
  }
  assert.ok(mosaicFills().every((f) => /^#[0-9A-Fa-f]{6}$/.test(f)));
});

test("glass: every triangle has three corners inside the 100 by 100 box", () => {
  for (let i = 0; i < TRIANGLE_COUNT; i++) {
    const pts = trianglePoints(i).split(" ").map((p) => p.split(",").map(Number));
    assert.equal(pts.length, 3);
    for (const [x, y] of pts) {
      assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100);
    }
  }
});

test("glass: the triangles tile the box (their areas add up to 10000)", () => {
  let area = 0;
  for (let i = 0; i < TRIANGLE_COUNT; i++) {
    const [[x1, y1], [x2, y2], [x3, y3]] = trianglePoints(i).split(" ").map((p) => p.split(",").map(Number));
    area += Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2);
  }
  assert.equal(Math.round(area), 10000);
});
