// Server-safe — no "use client" directive.

export type BudgetPeriod =
  | { type: "month"; month: string }   // month = "YYYY-MM"
  | { type: "year"; year: number };

export function parseBudgetPeriod(params: {
  view?: string;
  month?: string;
  year?: string;
}): BudgetPeriod {
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

export function budgetPeriodBounds(period: BudgetPeriod): {
  startDate: string;
  endDate: string;
} {
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
  if (period.type === "month") return `?month=${period.month}`;
  return `?view=year&year=${period.year}`;
}

export function prevPeriod(period: BudgetPeriod): BudgetPeriod {
  if (period.type === "year") return { type: "year", year: period.year - 1 };
  const [y, m] = period.month.split("-").map(Number);
  const d = new Date(y, m - 2, 1); // go back one month
  return {
    type: "month",
    month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
  };
}

export function nextPeriod(period: BudgetPeriod): BudgetPeriod {
  if (period.type === "year") return { type: "year", year: period.year + 1 };
  const [y, m] = period.month.split("-").map(Number);
  const d = new Date(y, m, 1); // go forward one month
  return {
    type: "month",
    month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
  };
}

/** Normalize a stored budget amount to the view's time scale. */
export function normalizedBudgetAmount(
  amount: number,
  budgetPeriod: string,
  viewType: "month" | "year"
): number {
  const monthly =
    budgetPeriod === "weekly"
      ? (amount * 52) / 12
      : budgetPeriod === "yearly"
      ? amount / 12
      : amount;
  return viewType === "year" ? monthly * 12 : monthly;
}
