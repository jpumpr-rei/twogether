import type Anthropic from "@anthropic-ai/sdk";

// Kept free of imports from sibling modules so it can be unit-tested directly under Node.

const MAX_HISTORY = 20;
const DAY_MS = 86_400_000;

const isDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/**
 * Reads the chat request body into a clean message history plus "today".
 *
 * `today` is the date on the user's device. The server runs on UTC, which is already tomorrow for a
 * US evening and would skew every "yesterday" or "last week"; a device date more than a day away from
 * the server's own is ignored as implausible.
 */
export function parseChatRequest(
  body: unknown,
  utcToday: string
): { messages: Anthropic.MessageParam[]; today: string } {
  const raw = (body && typeof body === "object" ? body : {}) as { messages?: unknown; today?: unknown };

  const messages: Anthropic.MessageParam[] = [];
  if (Array.isArray(raw.messages)) {
    for (const m of raw.messages) {
      if (!m || typeof m !== "object") continue;
      const { role, content } = m as { role?: unknown; content?: unknown };
      if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
        messages.push({ role, content });
      }
    }
  }

  // A conversation has to open and close with the user's turn.
  const recent = messages.slice(-MAX_HISTORY);
  while (recent.length > 0 && recent[0].role !== "user") recent.shift();
  while (recent.length > 0 && recent[recent.length - 1].role !== "user") recent.pop();

  const today =
    isDate(raw.today) && Math.abs(Date.parse(raw.today) - Date.parse(utcToday)) <= DAY_MS
      ? raw.today
      : utcToday;

  return { messages: recent, today };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

/**
 * The date ranges people usually mean ("last month", "this week"), worked out here so the model can
 * copy them instead of doing calendar arithmetic, which small models get wrong at month and year
 * boundaries. Weeks run Monday to Sunday. Both ends are inclusive.
 */
export function commonRanges(today: string): { label: string; from: string; to: string }[] {
  const t = new Date(`${today}T00:00:00Z`);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const monday = addDays(t, -((t.getUTCDay() + 6) % 7));
  const range = (label: string, from: Date | string, to: Date | string) => ({
    label,
    from: typeof from === "string" ? from : iso(from),
    to: typeof to === "string" ? to : iso(to),
  });

  return [
    range("Today", today, today),
    range("Yesterday", addDays(t, -1), addDays(t, -1)),
    range("This week", monday, addDays(monday, 6)),
    range("Last week", addDays(monday, -7), addDays(monday, -1)),
    range("Last 7 days", addDays(t, -6), today),
    range("Last 30 days", addDays(t, -29), today),
    range("This month", new Date(Date.UTC(y, m, 1)), new Date(Date.UTC(y, m + 1, 0))),
    range("Last month", new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(y, m, 0))),
    range("This year so far", `${y}-01-01`, today),
  ];
}

export type PromptInput = {
  today: string;
  dataRange: { earliest: string | null; latest: string | null };
  categories: string[];
  budgets: { category: string; monthlyBudget: number }[];
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function buildSystemPrompt({ today, dataRange, categories, budgets }: PromptInput): string {
  const weekday = WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()];
  const coverage =
    dataRange.earliest && dataRange.latest
      ? `Their transactions on file run from ${dataRange.earliest} to ${dataRange.latest}.`
      : "They have no transactions on file yet.";

  const ranges = commonRanges(today)
    .map(({ label, from, to }) => `- ${label}: ${from === to ? from : `${from} to ${to}`}`)
    .join("\n");

  return `You are a friendly, helpful personal finance assistant for a couple using the Twogether budgeting app.

Today is ${weekday}, ${today}. ${coverage}

Handy date ranges (both ends inclusive; weeks run Monday to Sunday):
${ranges}

You can look up their transactions with tools:
- get_spending: exact totals for any date range, optionally for one category or merchant, broken down by category, merchant, day or month.
- list_transactions: the individual transactions in a date range.

How to answer:
- Use the tools for every amount, count, date or merchant question. Never estimate, and never add numbers up yourself.
- Turn the user's wording into exact dates ("yesterday", "last week", "Oct 12 to 18"), using the handy ranges above where they fit. When the wording is relative or ambiguous, say which dates you used.
- "Spent" means purchases. Refunds and reimbursements come back as "credits"; mention them only when they matter. Payments and transfers between their own accounts are not spending and are left out.
- If the tools find nothing for the dates asked, say what range you do have on file rather than guessing.
- Amounts are US dollars.

Spending categories: ${categories.join(", ") || "none yet"}

Monthly budget targets:
${JSON.stringify(budgets, null, 2)}

Guidelines:
- Be conversational and friendly
- Use specific numbers from their data
- Keep responses concise (2-4 sentences unless they ask for detail)
- If they ask about something outside the data, be honest that you don't have that info
- Mention both people's perspective when relevant ("you both", "as a couple")`;
}
