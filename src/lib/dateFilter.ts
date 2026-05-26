// Shared date filter types and utilities — no "use client", safe to import in server components

export type DateFilter =
  | { type: "all" }
  | { type: "month"; month: string }           // "YYYY-MM"
  | { type: "range"; from: string; to: string }; // "YYYY-MM-DD"

export function dateFilterLabel(filter: DateFilter): string {
  if (filter.type === "all") return "All time";
  if (filter.type === "month") {
    const [y, m] = filter.month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("default", {
      month: "short",
      year: "numeric",
    });
  }
  const from = new Date(filter.from + "T00:00:00");
  const to = new Date(filter.to + "T00:00:00");
  const sameYear = from.getFullYear() === to.getFullYear();
  const fmtFrom = from.toLocaleDateString("default", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const fmtTo = to.toLocaleDateString("default", { month: "short", day: "numeric" });
  return `${fmtFrom} – ${fmtTo}`;
}

export function dateFilterBounds(filter: DateFilter): {
  startDate: string | null;
  endDate: string | null;
} {
  if (filter.type === "all") return { startDate: null, endDate: null };
  if (filter.type === "month") {
    const [y, m] = filter.month.split("-").map(Number);
    return {
      startDate: `${filter.month}-01`,
      endDate: new Date(y, m, 0).toISOString().split("T")[0],
    };
  }
  return { startDate: filter.from, endDate: filter.to };
}

export function parseDateFilter(params: {
  month?: string;
  from?: string;
  to?: string;
}): DateFilter {
  if (params.from && params.to) return { type: "range", from: params.from, to: params.to };
  if (params.month) return { type: "month", month: params.month };
  return { type: "all" };
}

export function dateFilterToSearch(filter: DateFilter): string {
  if (filter.type === "all") return "";
  if (filter.type === "month") return `?month=${filter.month}`;
  return `?from=${filter.from}&to=${filter.to}`;
}
