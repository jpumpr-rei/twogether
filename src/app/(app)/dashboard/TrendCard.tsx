"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  filterByLens,
  monthlyAmount,
  type BudgetRow,
  type CardOwners,
  type People,
} from "@/lib/home/metrics";
import type { CategoryInfo, Lens, TxPoint } from "@/lib/home/types";

// periodKey: "YYYY-MM" for monthly view, "YYYY" for annual view
type ChartPoint = { label: string; amount: number; periodKey: string };
type ViewType = "monthly" | "annual";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-ink px-3 py-2 text-sm">
      <p className="mb-0.5 text-xs text-mute-dark">{label}</p>
      <p className="font-display font-extrabold text-white">
        ${payload[0].value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}

export default function TrendCard({
  transactions,
  categories,
  budgets,
  lens,
  people,
  cardOwners,
  accent,
}: {
  transactions: TxPoint[];
  categories: CategoryInfo[];
  budgets: BudgetRow[];
  lens: Lens;
  people: People;
  cardOwners: CardOwners;
  /** the lens colour, readable on black */
  accent: string;
}) {
  const router = useRouter();
  const [viewType, setViewType] = useState<ViewType>("monthly");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  const visible = useMemo(
    () => filterByLens(transactions, lens, people, cardOwners),
    [transactions, lens, people, cardOwners]
  );

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Only show categories that have transactions in view
  const activeCategories = useMemo(() => {
    const usedIds = new Set(visible.map((t) => t.category_id).filter(Boolean));
    return categories.filter((c) => usedIds.has(c.id));
  }, [visible, categories]);

  // If the lens changes and the chosen category has nothing in it any more, show everything.
  const categoryId =
    selectedCatId && activeCategories.some((c) => c.id === selectedCatId) ? selectedCatId : null;

  const chartData = useMemo((): ChartPoint[] => {
    const filtered = categoryId ? visible.filter((t) => t.category_id === categoryId) : visible;

    if (viewType === "monthly") {
      const points: ChartPoint[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString("default", { month: "short" });
        const amount = filtered
          .filter((t) => t.date.startsWith(key))
          .reduce((s, t) => s + t.amount, 0);
        points.push({ label, amount: Math.max(0, Math.round(amount)), periodKey: key });
      }
      return points;
    }
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 3 }, (_, i) => {
      const year = currentYear - 2 + i;
      const amount = filtered
        .filter((t) => t.date.startsWith(String(year)))
        .reduce((s, t) => s + t.amount, 0);
      return { label: String(year), amount: Math.max(0, Math.round(amount)), periodKey: String(year) };
    });
  }, [visible, viewType, categoryId]);

  // Budgets belong to the household, so the reference line only makes sense for Ours.
  const budgetLine = useMemo((): number | null => {
    if (lens !== "ours" || !budgets.length) return null;
    let monthly: number;
    if (categoryId) {
      const b = budgets.find((x) => x.category_id === categoryId);
      if (!b) return null;
      monthly = monthlyAmount(b);
    } else {
      monthly = budgets.reduce((s, b) => s + monthlyAmount(b), 0);
    }
    return Math.round(viewType === "annual" ? monthly * 12 : monthly);
  }, [budgets, categoryId, viewType, lens]);

  // Y-axis ceiling: whichever is larger, max spend or budget, with 15% headroom so the
  // "Budget $Xk" label isn't clipped against the top edge.
  const yMax = useMemo(() => {
    const maxData = Math.max(...chartData.map((p) => p.amount), 0);
    const cap = Math.max(maxData, budgetLine ?? 0);
    return Math.round(cap * 1.15) || 100;
  }, [chartData, budgetLine]);

  // Chart click -> budget detail page
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleChartClick(data: any) {
    if (!categoryId || !data?.activePayload?.[0]) return;
    const { periodKey } = data.activePayload[0].payload as ChartPoint;
    if (viewType === "monthly") {
      router.push(`/budgets/${categoryId}?view=month&month=${periodKey}`);
    } else {
      router.push(`/budgets/${categoryId}?view=year&year=${periodKey}`);
    }
  }

  const selectedCat = categoryId ? catMap.get(categoryId) : null;
  const accentColor = selectedCat?.color ?? accent;
  const fillColor = accentColor + "33"; // 20% opacity fill

  const yFormatter = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`);

  const axisProps = {
    tick: { fontSize: 11, fill: "#A1A1A8" },
    axisLine: false as const,
    tickLine: false as const,
  };

  const budgetRefLine =
    budgetLine && budgetLine > 0 ? (
      <ReferenceLine
        y={budgetLine}
        stroke="#A1A1A8"
        strokeDasharray="5 4"
        strokeWidth={1.5}
        label={{
          value: `Budget ${yFormatter(budgetLine)}`,
          position: "insideTopRight",
          fontSize: 10,
          fill: "#A1A1A8",
        }}
      />
    ) : null;

  const pill = (on: boolean) =>
    `flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      on ? "bg-white text-ink" : "bg-line text-mute-dark"
    }`;

  return (
    <section className="rounded-card bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-display text-[26px] font-extrabold leading-[0.95] tracking-[-0.03em] text-white">
          Trends
        </p>
        <div className="flex gap-0.5 rounded-full bg-line p-0.5">
          {(["monthly", "annual"] as ViewType[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewType(v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                viewType === v ? "bg-white text-ink" : "text-mute-dark"
              }`}
            >
              {v === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter pills, horizontally scrollable */}
      <div className="scrollbar-none -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        <button onClick={() => setSelectedCatId(null)} className={pill(!categoryId)}>
          All
        </button>
        {activeCategories.map((cat) => {
          const active = categoryId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(active ? null : cat.id)}
              className={`${pill(active)} flex items-center gap-1`}
            >
              <span>{cat.icon ?? "📦"}</span>
              {cat.name}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart
          data={chartData}
          margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
          onClick={handleChartClick}
          style={categoryId ? { cursor: "pointer" } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2E" vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis tickFormatter={yFormatter} {...axisProps} width={44} domain={[0, yMax]} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.06)" }} />
          <Bar
            dataKey="amount"
            fill={fillColor}
            stroke={accentColor}
            strokeWidth={1}
            radius={[5, 5, 0, 0]}
            maxBarSize={44}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke={accentColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: accentColor, strokeWidth: 0 }}
          />
          {budgetRefLine}
        </ComposedChart>
      </ResponsiveContainer>

      {selectedCat ? (
        <p className="mt-2 text-center text-xs text-mute-dark">
          Showing: {selectedCat.icon} {selectedCat.name}
        </p>
      ) : null}
    </section>
  );
}
