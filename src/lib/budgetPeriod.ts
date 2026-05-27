// Server-safe — no "use client" directive.

export type BudgetPeriod =
  | { type: "month"; month: string }              // month = "YYYY-MM"
  | { type: "year"; year: number }
  | { type: "range"; from: string; to: string };  // from/to = "YYYY-MM-DD"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseBudgetPeriod(params: {
  view?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
}): BudgetPeriod {
  if (params.view === "range") {
    if (
      params.from && DATE_RE.test(params.from) &&
      params.to   && DATE_RE.test(params.to) &&
      params.from <= params.to
    ) {
      return { type: "range", from: params.from, to: params.to };
    }
    // Invalid or missing dates — fall back to last 30 days
    const to   = new Date();
    const from = new Date(to.getTime() - 29 * 86_400_000);
    return { type: "range", from: toDateStr(from), to: toDateStr(to) };
  }
  if (params.view === "year") {
    const y = parseInt(params.year ?? "", 10);
    if (!isNaN(y) && y >= 2020 && y <= 2100) return { type: "year", year: y };
    return { type: "year", year: new Date().getFullYear() };
  }
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    return { type: "month", month: params.month };
  }
  const now = new Date();
  return {
    type: "month",
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  };
}

/** Number of calendar days covered by a range (inclusive). */
export function rangeDays(from: string, to: string): number {
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(1, Math.round(diff / 86_400_000) + 1);
}

export function budgetPeriodBounds(period: BudgetPeriod): {
  startDate: string;
  endDate: string;
} {
  if (period.type === "range") {
    return { startDate: period.from, endDate: period.to };
  }
  if (period.type === "month") {
    const [y, m] = period.month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return {
      startDate: `${period.month}-01`,
      endDate: `${period.month}-${String(last).padStart(2, "0")}`,
    };
  }
  return { startDate: `${period.year}-01-01`, endDate: `${period.year}-12-31` };
}

export function budgetPeriodLabel(period: BudgetPeriod): string {
  if (period.type === "range") return `${period.from} – ${period.to}`;
  if (period.type === "month") {
    const [y, m] = period.month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
  }
  return String(period.year);
}

export function budgetPeriodToSearch(period: BudgetPeriod): string {
  if (period.type === "range") return `?view=range&from=${period.from}&to=${period.to}`;
  if (period.type === "month") return `?month=${period.month}`;
  return `?view=year&year=${period.year}`;
}

export function prevPeriod(period: BudgetPeriod): BudgetPeriod {
  if (period.type === "range") return period; // no-op — range has inline pickers
  if (period.type === "year") return { type: "year", year: period.year - 1 };
  const [y, m] = period.month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return {
    type: "month",
    month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
  };
}

export function nextPeriod(period: BudgetPeriod): BudgetPeriod {
  if (period.type === "range") return period; // no-op
  if (period.type === "year") return { type: "year", year: period.year + 1 };
  const [y, m] = period.month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return {
    type: "month",
    month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
  };
}

/**
 * Normalize a stored budget amount to the view's time scale.
 *
 * Range view pro-rates monthly budget proportionally:
 *   displayAmount = (monthlyAmount / 30) × rangeDaysCount
 */
export function normalizedBudgetAmount(
  amount: number,
  budgetPeriod: string,
  viewType: "month" | "year" | "range",
  rangeDaysCount?: number
): number {
  // Convert stored amount → monthly equivalent
  const monthly =
    budgetPeriod === "weekly"
      ? (amount * 52) / 12
      : budgetPeriod === "yearly"
      ? amount / 12
      : amount;

  if (viewType === "year")  return monthly * 12;
  if (viewType === "range") return (monthly / 30) * (rangeDaysCount ?? 30);
  return monthly;
}
