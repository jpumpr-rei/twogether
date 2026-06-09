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
 * Returns date bounds for the two comparison periods used for variance display.
 *
 * Monthly  → prev month  +  same month last year
 * Yearly   → prev year   +  null (prev year IS the YoY, no second comparison)
 * Range    → prev equivalent window  +  same window one year ago
 */
export function comparisonBounds(period: BudgetPeriod): {
  prevBounds: { startDate: string; endDate: string } | null;
  yoyBounds:  { startDate: string; endDate: string } | null;
} {
  function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }

  if (period.type === "month") {
    const [y, m] = period.month.split("-").map(Number);
    const prevD = new Date(y, m - 2, 1);
    const pY = prevD.getFullYear(), pM = prevD.getMonth() + 1;
    const lyY = y - 1;
    return {
      prevBounds: {
        startDate: `${pY}-${String(pM).padStart(2,"0")}-01`,
        endDate:   `${pY}-${String(pM).padStart(2,"0")}-${String(daysInMonth(pY, pM)).padStart(2,"0")}`,
      },
      yoyBounds: {
        startDate: `${lyY}-${String(m).padStart(2,"0")}-01`,
        endDate:   `${lyY}-${String(m).padStart(2,"0")}-${String(daysInMonth(lyY, m)).padStart(2,"0")}`,
      },
    };
  }

  if (period.type === "year") {
    const py = period.year - 1;
    return {
      prevBounds: { startDate: `${py}-01-01`, endDate: `${py}-12-31` },
      yoyBounds: null,
    };
  }

  // Range — shift back by the same number of days, and same window last year
  const fromMs = new Date(period.from + "T00:00:00").getTime();
  const toMs   = new Date(period.to   + "T00:00:00").getTime();
  const days   = Math.round((toMs - fromMs) / 86_400_000) + 1;
  const prevTo   = new Date(fromMs - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000);
  return {
    prevBounds: { startDate: toDateStr(prevFrom), endDate: toDateStr(prevTo) },
    yoyBounds: {
      startDate: `${parseInt(period.from) - 1}${period.from.slice(4)}`,
      endDate:   `${parseInt(period.to)   - 1}${period.to.slice(4)}`,
    },
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
