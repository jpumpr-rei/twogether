import type { Lens } from "./types";

// What the Home screen shows, computed from a month of transactions. Pure functions so the same
// rules run on the server and in the browser (the lens switches instantly, with no round trip),
// and so they can be tested. Category totals follow exactly the rules of the Budgets page
// (budgets/page.tsx) so the numbers on both screens always agree.

export type SplitRow = { category_id: string | null; amount: number };

export type SpendRow = {
  amount: number;
  category_id: string | null;
  card_id: string | null;
  splits: SplitRow[] | null;
};

export type BudgetRow = { category_id: string | null; amount: number; period: string };

/** card id -> id of the person who holds the card */
export type CardOwners = Record<string, string>;

export type People = { me: string; partner: string | null };

const sum = (values: Iterable<number>) => {
  let total = 0;
  for (const v of values) total += v;
  return total;
};

/** A budget's amount per month, whatever period it was entered in. */
export function monthlyAmount(b: { amount: number; period: string }): number {
  if (b.period === "yearly") return b.amount / 12;
  if (b.period === "weekly") return (b.amount * 52) / 12;
  return b.amount;
}

/** Whose money a transaction is: the holder of its card, or null for entries made by hand. */
export function ownerOf(row: { card_id: string | null }, cardOwners: CardOwners): string | null {
  return row.card_id ? (cardOwners[row.card_id] ?? null) : null;
}

/** Ours shows everything. Mine and Theirs show only that person's cards; hand-entered items are shared. */
export function filterByLens<T extends { card_id: string | null }>(
  rows: T[],
  lens: Lens,
  people: People,
  cardOwners: CardOwners
): T[] {
  if (lens === "ours") return rows;
  const who = lens === "mine" ? people.me : people.partner;
  if (!who) return [];
  return rows.filter((r) => ownerOf(r, cardOwners) === who);
}

/** Spending per category: a categorised transaction counts in full, a split counts its positive portions. */
export function categorySpend(rows: SpendRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const tx of rows) {
    if (tx.category_id) out.set(tx.category_id, (out.get(tx.category_id) ?? 0) + tx.amount);
    for (const s of tx.splits ?? []) {
      if (s.category_id && s.amount > 0) {
        out.set(s.category_id, (out.get(s.category_id) ?? 0) + s.amount);
      }
    }
  }
  return out;
}

export type Share = { mine: number; theirs: number; shared: number };

/** Spending per category, split by whose card it went on. */
export function categoryShares(
  rows: SpendRow[],
  cardOwners: CardOwners,
  people: People
): Map<string, Share> {
  const out = new Map<string, Share>();
  const add = (category: string, amount: number, owner: string | null) => {
    const share = out.get(category) ?? { mine: 0, theirs: 0, shared: 0 };
    if (owner && owner === people.me) share.mine += amount;
    else if (owner && owner === people.partner) share.theirs += amount;
    else share.shared += amount;
    out.set(category, share);
  };
  for (const tx of rows) {
    const owner = ownerOf(tx, cardOwners);
    if (tx.category_id) add(tx.category_id, tx.amount, owner);
    for (const s of tx.splits ?? []) {
      if (s.category_id && s.amount > 0) add(s.category_id, s.amount, owner);
    }
  }
  return out;
}

/** Days left in the month, counting today. */
export function daysLeftInMonth(now: Date): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return last - now.getDate() + 1;
}

export type Hero =
  | { kind: "left"; amount: number; budgeted: number; spent: number; perDay: number; daysLeft: number }
  | { kind: "over"; amount: number; budgeted: number; spent: number; daysLeft: number }
  | { kind: "spent"; amount: number; sharePct: number | null; hasBudgets: boolean };

/**
 * The big number. Ours shows what is left of this month's budgets (or what is over), and falls
 * back to what was spent when there are no budgets. Mine and Theirs show what that person spent,
 * because budgets belong to the household and have no per-person remainder.
 */
export function computeHero(args: {
  rows: SpendRow[];
  budgets: BudgetRow[];
  lens: Lens;
  people: People;
  cardOwners: CardOwners;
  daysLeft: number;
}): Hero {
  const { rows, budgets, lens, people, cardOwners, daysLeft } = args;
  const budgeted = budgets.filter((b) => b.category_id);

  if (lens === "ours" && budgeted.length > 0) {
    const spendBy = categorySpend(rows);
    const total = sum(budgeted.map(monthlyAmount));
    const spent = sum(budgeted.map((b) => spendBy.get(b.category_id as string) ?? 0));
    const left = total - spent;
    if (left >= 0) {
      return {
        kind: "left",
        amount: left,
        budgeted: total,
        spent,
        perDay: daysLeft > 0 ? left / daysLeft : left,
        daysLeft,
      };
    }
    return { kind: "over", amount: -left, budgeted: total, spent, daysLeft };
  }

  const amount = sum(categorySpend(filterByLens(rows, lens, people, cardOwners)).values());
  const household = sum(categorySpend(rows).values());
  return {
    kind: "spent",
    amount,
    sharePct: lens === "ours" || household <= 0 ? null : Math.round((amount / household) * 100),
    hasBudgets: budgeted.length > 0,
  };
}

export type BudgetCardData = {
  categoryId: string;
  budget: number;
  /** what the household has spent, used for the percentage and the ranking */
  householdSpent: number;
  /** what the current lens shows */
  lensSpent: number;
  pct: number;
  over: number;
  shares: Share;
};

/** The budgets closest to (or past) their limit, most pressing first. */
export function budgetCards(args: {
  rows: SpendRow[];
  budgets: BudgetRow[];
  lens: Lens;
  people: People;
  cardOwners: CardOwners;
  limit?: number;
}): BudgetCardData[] {
  const { rows, budgets, lens, people, cardOwners, limit = 3 } = args;
  const shares = categoryShares(rows, cardOwners, people);
  const cards: BudgetCardData[] = [];
  for (const b of budgets) {
    if (!b.category_id) continue;
    const budget = monthlyAmount(b);
    if (budget <= 0) continue;
    const s = shares.get(b.category_id) ?? { mine: 0, theirs: 0, shared: 0 };
    const householdSpent = s.mine + s.theirs + s.shared;
    cards.push({
      categoryId: b.category_id,
      budget,
      householdSpent,
      lensSpent: lens === "ours" ? householdSpent : lens === "mine" ? s.mine : s.theirs,
      pct: householdSpent / budget,
      over: Math.max(0, householdSpent - budget),
      shares: s,
    });
  }
  return cards.sort((a, b) => b.pct - a.pct).slice(0, limit);
}
