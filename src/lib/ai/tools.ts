import type Anthropic from "@anthropic-ai/sdk";

// What the finance assistant can look up.
//
// The assistant used to be handed one fixed monthly summary (a total and the top few categories per
// month, rounded to whole dollars), so it couldn't answer anything finer than a month. These tools
// let it query the couple's transactions for any dates, and the arithmetic happens here, in exact
// cents, instead of in the model's head.

// ── The slice of the Supabase client these tools use (structural, so tests can fake it) ──────────

export interface TransactionQuery {
  select(columns: string): TransactionQuery;
  eq(column: string, value: string): TransactionQuery;
  gte(column: string, value: string): TransactionQuery;
  lte(column: string, value: string): TransactionQuery;
  order(column: string, options?: { ascending?: boolean }): TransactionQuery;
  range(
    from: number,
    to: number
  ): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
}

export interface ToolDb {
  from(table: "transactions"): TransactionQuery;
}

export type ToolContext = {
  db: ToolDb;
  coupleId: string;
  /** Earliest and latest transaction dates on file; used to explain an empty result. */
  dataRange: { earliest: string | null; latest: string | null };
};

export type ToolResult = { content: string; isError?: boolean };

// ── Reading transactions ─────────────────────────────────────────────────────────────────────────

export type SpendRow = {
  date: string;
  amount: number;
  merchant_name: string | null;
  note: string | null;
  is_pending: boolean;
  is_transfer: boolean;
  category_id: string | null;
  category: { name: string } | null;
  splits: { amount: number; category: { name: string } | null }[] | null;
};

const COLUMNS = `date, amount, merchant_name, note, is_pending, is_transfer, category_id,
  category:categories(name),
  splits:transaction_splits(amount, category:categories(name))`;

// PostgREST silently caps a response at 1000 rows, so a wide date range has to be read in pages.
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

export async function fetchRows(
  db: ToolDb,
  coupleId: string,
  start: string,
  end: string
): Promise<{ rows: SpendRow[]; truncated: boolean }> {
  const rows: SpendRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await db
      .from("transactions")
      .select(COLUMNS)
      .eq("couple_id", coupleId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .order("id")
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as SpendRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

// ── Turning transactions into spending ───────────────────────────────────────────────────────────

/** One amount attributed to one category: a whole transaction, or one portion of a split one. */
export type Line = {
  /** Identifies the parent transaction, so split portions aren't counted as separate transactions. */
  id: number;
  date: string;
  merchant: string;
  note: string | null;
  amount: number;
  category: string | null;
  pending: boolean;
  split: boolean;
};

export function toLines(rows: SpendRow[]): Line[] {
  const lines: Line[] = [];
  rows.forEach((tx, id) => {
    const base = {
      id,
      date: tx.date,
      merchant: tx.merchant_name?.trim() || "Unknown merchant",
      note: tx.note?.trim() || null,
      pending: tx.is_pending,
    };

    const splits = tx.splits ?? [];
    if (splits.length > 0) {
      // A split transaction has no category of its own; its categories live on the portions.
      // Portions are stored as positive amounts, so a split refund keeps the refund's sign.
      const sign = tx.amount < 0 ? -1 : 1;
      for (const s of splits) {
        lines.push({
          ...base,
          amount: sign * Math.abs(s.amount),
          category: s.category?.name ?? null,
          split: true,
        });
      }
      return;
    }

    // Card payments and transfers between the couple's own accounts aren't spending.
    if (tx.is_transfer && !tx.category_id) return;

    lines.push({ ...base, amount: tx.amount, category: tx.category?.name ?? null, split: false });
  });
  return lines;
}

export function filterLines(
  lines: Line[],
  { category, merchant }: { category?: string; merchant?: string }
): Line[] {
  let out = lines;

  const cat = category?.trim().toLowerCase();
  if (cat) {
    if (cat === "uncategorized") {
      out = out.filter((l) => l.category === null);
    } else {
      // An exact category name wins; otherwise fall back to "contains" so "food" finds "Food & Drink".
      const exact = out.some((l) => l.category?.toLowerCase() === cat);
      out = out.filter((l) => {
        const name = l.category?.toLowerCase();
        return name !== undefined && (exact ? name === cat : name.includes(cat));
      });
    }
  }

  const m = merchant?.trim().toLowerCase();
  if (m) out = out.filter((l) => l.merchant.toLowerCase().includes(m));

  return out;
}

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

export type GroupBy = "none" | "category" | "merchant" | "day" | "month";
const GROUP_BYS: readonly GroupBy[] = ["none", "category", "merchant", "day", "month"];
const MAX_GROUPS: Record<GroupBy, number> = { none: 0, category: 30, merchant: 25, day: 100, month: 36 };

type Tally = { spent: number; credits: number; ids: Set<number> };
const newTally = (): Tally => ({ spent: 0, credits: 0, ids: new Set() });

function groupKey(line: Line, by: Exclude<GroupBy, "none">): string {
  switch (by) {
    case "category":
      return line.category ?? "Uncategorized";
    case "merchant":
      return line.merchant;
    case "day":
      return line.date;
    case "month":
      return line.date.slice(0, 7);
  }
}

/** Totals in exact cents. Purchases are "spent"; refunds and reimbursements are "credits". */
export function summarize(lines: Line[], groupBy: GroupBy) {
  const total = newTally();
  const groups = new Map<string, Tally>();

  const add = (tally: Tally, line: Line) => {
    const cents = toCents(line.amount);
    if (cents >= 0) tally.spent += cents;
    else tally.credits += -cents;
    tally.ids.add(line.id);
  };

  for (const line of lines) {
    add(total, line);
    if (groupBy !== "none") {
      const key = groupKey(line, groupBy);
      let tally = groups.get(key);
      if (!tally) groups.set(key, (tally = newTally()));
      add(tally, line);
    }
  }

  const out: {
    transactions: number;
    spent: number;
    credits: number;
    net: number;
    group_by?: GroupBy;
    groups?: { key: string; spent: number; credits: number; transactions: number }[];
    groups_omitted?: number;
  } = {
    transactions: total.ids.size,
    spent: fromCents(total.spent),
    credits: fromCents(total.credits),
    net: fromCents(total.spent - total.credits),
  };

  if (groupBy !== "none") {
    const chronological = groupBy === "day" || groupBy === "month";
    const sorted = [...groups.entries()].sort(([ka, a], [kb, b]) =>
      chronological ? ka.localeCompare(kb) : b.spent - a.spent || b.credits - a.credits || ka.localeCompare(kb)
    );
    const cap = MAX_GROUPS[groupBy];
    out.group_by = groupBy;
    out.groups = sorted.slice(0, cap).map(([key, t]) => ({
      key,
      spent: fromCents(t.spent),
      credits: fromCents(t.credits),
      transactions: t.ids.size,
    }));
    if (sorted.length > cap) out.groups_omitted = sorted.length - cap;
  }

  return out;
}

export type SortBy = "date" | "amount";

export function listLines(lines: Line[], sort: SortBy, limit: number) {
  const sorted = [...lines].sort(
    sort === "amount"
      ? (a, b) => toCents(b.amount) - toCents(a.amount) || b.date.localeCompare(a.date)
      : (a, b) => b.date.localeCompare(a.date) || toCents(b.amount) - toCents(a.amount)
  );
  const shown = sorted.slice(0, limit);
  return {
    total_matching: lines.length,
    showing: shown.length,
    transactions: shown.map((l) => ({
      date: l.date,
      merchant: l.merchant,
      amount: fromCents(toCents(l.amount)),
      category: l.category ?? "Uncategorized",
      ...(l.pending ? { pending: true } : {}),
      ...(l.split ? { split: true } : {}),
      ...(l.note ? { note: l.note } : {}),
    })),
  };
}

// ── Input handling ───────────────────────────────────────────────────────────────────────────────

class ToolInputError extends Error {}

/** True only for a real calendar date written YYYY-MM-DD (so "2026-02-30" is rejected). */
export function isRealDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function parseRange(args: Record<string, unknown>): { start: string; end: string } {
  const { start_date: start, end_date: end } = args;
  if (!isRealDate(start) || !isRealDate(end)) {
    throw new ToolInputError(
      "start_date and end_date are both required and must be real calendar dates written YYYY-MM-DD."
    );
  }
  if (start > end) throw new ToolInputError("start_date must not be after end_date.");
  return { start, end };
}

const optionalText = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

// ── The tools ────────────────────────────────────────────────────────────────────────────────────
//
// No `eager_input_streaming`: the inputs are a few short fields, so there is nothing to gain from
// streaming them, and leaving it off keeps the API's own schema validation in front of our checks.

export const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_spending",
    description:
      "Exact spending totals for a date range, computed from the couple's transactions. Call this whenever the user asks how much they spent: overall, on specific dates or a date range, in a category, or at a merchant, or when they want totals broken down by category, merchant, day or month. Both dates are inclusive. Payments and transfers between the couple's own accounts are excluded. Always use this instead of adding amounts up yourself.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "First day to include, YYYY-MM-DD." },
        end_date: {
          type: "string",
          description: "Last day to include, YYYY-MM-DD. Use the same date as start_date for a single day.",
        },
        category: {
          type: "string",
          description:
            "Optional. Only count this category, e.g. 'Groceries'. Use 'Uncategorized' for transactions with no category.",
        },
        merchant: {
          type: "string",
          description: "Optional. Only count merchants whose name contains this text (not case-sensitive), e.g. 'costco'.",
        },
        group_by: {
          type: "string",
          enum: [...GROUP_BYS],
          description:
            "How to break the total down. Default 'category'. Use 'day' for a day-by-day view of a short range, 'month' for a longer one, 'none' for just the total.",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "list_transactions",
    description:
      "List the individual transactions in a date range, with date, merchant, amount and category. Call this when the user asks what they bought or where, wants to see specific transactions, or asks for their biggest purchases. Both dates are inclusive. Payments and transfers between the couple's own accounts are excluded. For totals, use get_spending instead.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "First day to include, YYYY-MM-DD." },
        end_date: {
          type: "string",
          description: "Last day to include, YYYY-MM-DD. Use the same date as start_date for a single day.",
        },
        category: { type: "string", description: "Optional. Only this category, e.g. 'Groceries', or 'Uncategorized'." },
        merchant: {
          type: "string",
          description: "Optional. Only merchants whose name contains this text (not case-sensitive).",
        },
        sort: {
          type: "string",
          enum: ["date", "amount"],
          description: "'date' (newest first, the default) or 'amount' (largest purchases first).",
        },
        limit: { type: "integer", description: "How many transactions to return. Default 25, at most 50." },
      },
      required: ["start_date", "end_date"],
    },
  },
];

const ok = (result: unknown): ToolResult => ({ content: JSON.stringify(result) });
const fail = (message: string): ToolResult => ({ content: message, isError: true });

async function loadLines(ctx: ToolContext, start: string, end: string) {
  const { rows, truncated } = await fetchRows(ctx.db, ctx.coupleId, start, end);
  return { lines: toLines(rows), truncated };
}

function notes(
  ctx: ToolContext,
  all: Line[],
  matched: Line[],
  truncated: boolean,
  filtered: boolean
): string | undefined {
  const parts: string[] = [];
  if (truncated) {
    parts.push("This range has too many transactions to read in full, so the figures are incomplete. Ask about a shorter range.");
  }
  if (all.length === 0) {
    const { earliest, latest } = ctx.dataRange;
    parts.push(
      earliest && latest
        ? `No transactions are on file for these dates. Transactions on file run from ${earliest} to ${latest}.`
        : "No transactions are on file for these dates."
    );
  } else if (filtered && matched.length === 0) {
    parts.push("Nothing in this range matched the category or merchant filter.");
  }
  return parts.length ? parts.join(" ") : undefined;
}

async function getSpending(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const { start, end } = parseRange(args);
  const category = optionalText(args.category);
  const merchant = optionalText(args.merchant);
  const groupBy = oneOf(args.group_by, GROUP_BYS, "category");

  const { lines, truncated } = await loadLines(ctx, start, end);
  const matched = filterLines(lines, { category, merchant });
  const note = notes(ctx, lines, matched, truncated, Boolean(category || merchant));

  return ok({
    start_date: start,
    end_date: end,
    ...(category ? { category } : {}),
    ...(merchant ? { merchant } : {}),
    ...summarize(matched, groupBy),
    ...(note ? { note } : {}),
  });
}

async function listTransactions(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const { start, end } = parseRange(args);
  const category = optionalText(args.category);
  const merchant = optionalText(args.merchant);
  const sort = oneOf<SortBy>(args.sort, ["date", "amount"], "date");
  const requested = typeof args.limit === "number" && Number.isFinite(args.limit) ? Math.floor(args.limit) : 25;
  const limit = Math.min(50, Math.max(1, requested));

  const { lines, truncated } = await loadLines(ctx, start, end);
  const matched = filterLines(lines, { category, merchant });
  const note = notes(ctx, lines, matched, truncated, Boolean(category || merchant));

  return ok({
    start_date: start,
    end_date: end,
    ...(category ? { category } : {}),
    ...(merchant ? { merchant } : {}),
    ...listLines(matched, sort, limit),
    ...(note ? { note } : {}),
  });
}

/**
 * Runs one tool call from the model. Bad input comes back as an error result the model can read and
 * correct; anything unexpected (a database failure) is thrown for the caller to report.
 */
export async function runAITool(name: string, input: unknown, ctx: ToolContext): Promise<ToolResult> {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  try {
    if (name === "get_spending") return await getSpending(args, ctx);
    if (name === "list_transactions") return await listTransactions(args, ctx);
    return fail(`Unknown tool: ${name}`);
  } catch (err) {
    if (err instanceof ToolInputError) return fail(err.message);
    throw err;
  }
}
