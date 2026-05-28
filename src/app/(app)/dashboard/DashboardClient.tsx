"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis,
  Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import AIChatSheet from "./AIChatSheet";
import type { TxPoint, CategoryInfo, RecentTx, BudgetInfo } from "./page";

// ── Types ─────────────────────────────────────────────────────────────────────

// periodKey: "YYYY-MM" for monthly view, "YYYY" for annual view
type ChartPoint = { label: string; amount: number; periodKey: string };
type ViewType = "monthly" | "annual";

const INSIGHT_CACHE_PREFIX = "tw_insights_";

// ── Tooltip ───────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 text-sm">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="font-bold text-gray-900">
        ${payload[0].value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DashboardClient({
  name,
  transactions,
  categories,
  recentTransactions,
  budgets,
}: {
  name: string;
  transactions: TxPoint[];
  categories: CategoryInfo[];
  recentTransactions: RecentTx[];
  budgets: BudgetInfo[];
}) {
  const router = useRouter();
  const [viewType, setViewType] = useState<ViewType>("monthly");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Only show categories that have transactions in the dataset
  const activeCategories = useMemo(() => {
    const usedIds = new Set(transactions.map((t) => t.category_id).filter(Boolean));
    return categories.filter((c) => usedIds.has(c.id));
  }, [transactions, categories]);

  // ── AI Insights ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const cacheKey = `${INSIGHT_CACHE_PREFIX}${new Date().toISOString().split("T")[0]}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) ?? "null");
      if (Array.isArray(cached) && cached.length) {
        setInsights(cached);
        setInsightsLoading(false);
        return;
      }
    } catch { /* ignore */ }

    fetch("/api/ai/insights")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.insights) && data.insights.length) {
          setInsights(data.insights);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(data.insights)); } catch { /* ignore */ }
        }
      })
      .catch(() => { /* degrade gracefully */ })
      .finally(() => setInsightsLoading(false));
  }, []);

  // ── Chart data ───────────────────────────────────────────────────────────────

  const chartData = useMemo((): ChartPoint[] => {
    const filtered = selectedCatId
      ? transactions.filter((t) => t.category_id === selectedCatId)
      : transactions;

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
    } else {
      const currentYear = new Date().getFullYear();
      return Array.from({ length: 3 }, (_, i) => {
        const year = currentYear - 2 + i;
        const amount = filtered
          .filter((t) => t.date.startsWith(String(year)))
          .reduce((s, t) => s + t.amount, 0);
        return { label: String(year), amount: Math.max(0, Math.round(amount)), periodKey: String(year) };
      });
    }
  }, [transactions, viewType, selectedCatId]);

  // ── Budget reference line ────────────────────────────────────────────────────

  const budgetLine = useMemo((): number | null => {
    if (!budgets.length) return null;

    const toMonthly = (b: BudgetInfo) =>
      b.period === "yearly"  ? b.amount / 12 :
      b.period === "weekly"  ? (b.amount * 52) / 12 :
      b.amount;

    let monthly: number;
    if (selectedCatId) {
      const b = budgets.find((b) => b.category_id === selectedCatId);
      if (!b) return null;
      monthly = toMonthly(b);
    } else {
      monthly = budgets.reduce((s, b) => s + toMonthly(b), 0);
    }

    return Math.round(viewType === "annual" ? monthly * 12 : monthly);
  }, [budgets, selectedCatId, viewType]);

  // Y-axis ceiling: whichever is larger — max spend or budget — with 15%
  // headroom so the "Budget $Xk" label isn't clipped against the top edge.
  const yMax = useMemo(() => {
    const maxData = Math.max(...chartData.map((p) => p.amount), 0);
    const cap = Math.max(maxData, budgetLine ?? 0);
    return Math.round(cap * 1.15) || 100;
  }, [chartData, budgetLine]);

  // ── Chart click → budget detail page ────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleChartClick(data: any) {
    if (!selectedCatId || !data?.activePayload?.[0]) return;
    const { periodKey } = data.activePayload[0].payload as ChartPoint;
    if (viewType === "monthly") {
      router.push(`/budgets/${selectedCatId}?view=month&month=${periodKey}`);
    } else {
      router.push(`/budgets/${selectedCatId}?view=year&year=${periodKey}`);
    }
  }

  const selectedCat = selectedCatId ? catMap.get(selectedCatId) : null;
  const accentColor = selectedCat?.color ?? "#f97316";
  const fillColor = accentColor + "33"; // 20% opacity fill for area/composed

  const yFormatter = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`;

  const axisProps = {
    tick: { fontSize: 11, fill: "#9ca3af" },
    axisLine: false as const,
    tickLine: false as const,
  };

  const chartMargin = { top: 4, right: 4, left: -10, bottom: 0 };

  const budgetRefLine = budgetLine && budgetLine > 0 ? (
    <ReferenceLine
      y={budgetLine}
      stroke="#6b7280"
      strokeDasharray="5 4"
      strokeWidth={1.5}
      label={{
        value: `Budget ${yFormatter(budgetLine)}`,
        position: "insideTopRight",
        fontSize: 10,
        fill: "#6b7280",
      }}
    />
  ) : null;

  const clickable = !!selectedCatId;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 pt-12 pb-36 space-y-6">
      {/* Greeting */}
      <div>
        <p className="text-gray-500 text-sm">Good to see you,</p>
        <h1 className="text-2xl font-bold text-gray-900">{name} 👋</h1>
      </div>

      {/* ── AI Insights ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          💡 Spending Insights
        </h2>
        {insightsLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
                <div className="h-3 bg-gray-100 rounded-full animate-pulse w-3/4" />
                <div className="h-3 bg-gray-100 rounded-full animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        ) : insights.length > 0 ? (
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="bg-white rounded-2xl px-4 py-3.5 shadow-sm flex gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {i === 0 ? "📊" : i === 1 ? "📈" : "💡"}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-gray-400 text-sm">
            Insights will appear once you have more transaction history.
          </div>
        )}
      </section>

      {/* ── Trend Chart ───────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl p-4 shadow-sm">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Spending Trends</h2>
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {(["monthly", "annual"] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewType(v)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors capitalize ${
                  viewType === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
                }`}
              >
                {v === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
        </div>

        {/* Category filter pills — horizontally scrollable */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <button
            onClick={() => setSelectedCatId(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              !selectedCatId
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            All
          </button>
          {activeCategories.map((cat) => {
            const active = selectedCatId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(active ? null : cat.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  active ? "text-white" : "bg-gray-100 text-gray-600"
                }`}
                style={active ? { backgroundColor: cat.color ?? "#f97316" } : {}}
              >
                <span>{cat.icon ?? "📦"}</span>
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart
            data={chartData}
            margin={chartMargin}
            onClick={handleChartClick}
            style={clickable ? { cursor: "pointer" } : undefined}
          >
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={accentColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={accentColor} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis tickFormatter={yFormatter} {...axisProps} width={44} domain={[0, yMax]} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
            <Bar dataKey="amount" fill={fillColor} stroke={accentColor} strokeWidth={1} radius={[5, 5, 0, 0]} maxBarSize={44} />
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

        {selectedCat && (
          <p className="text-center text-xs text-gray-400 mt-2">
            Showing: {selectedCat.icon} {selectedCat.name}
          </p>
        )}
      </section>

      {/* ── Recent Activity ────────────────────────────────────────────────────── */}
      {recentTransactions.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Recent Activity
            </h2>
            <button
              onClick={() => router.push("/transactions")}
              className="text-xs text-orange-500 font-semibold hover:opacity-75"
            >
              See all →
            </button>
          </div>
          <div className="bg-white rounded-2xl divide-y divide-gray-50 shadow-sm overflow-hidden">
            {recentTransactions.map((tx) => {
              const cat = tx.category_id ? catMap.get(tx.category_id) : null;
              const iconBg = cat?.color ? cat.color + "22" : "#f3f4f6";
              const isCredit = tx.amount < 0;
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: iconBg }}
                  >
                    {cat?.icon ?? "📦"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm">
                      {tx.merchant_name ?? "Unknown merchant"}
                    </p>
                    <p className="text-xs text-gray-400">{tx.date}</p>
                  </div>
                  <span className={`font-semibold text-sm tabular-nums ${isCredit ? "text-green-500" : "text-gray-800"}`}>
                    {isCredit ? "+" : ""}${Math.abs(tx.amount).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Chat FAB ──────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setShowChat(true)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 bg-orange-500 text-white rounded-full shadow-xl flex items-center justify-center text-2xl hover:bg-orange-600 active:bg-orange-600 transition-transform active:scale-95"
        aria-label="Ask AI about your spending"
      >
        💬
      </button>

      {showChat && <AIChatSheet onClose={() => setShowChat(false)} />}
    </div>
  );
}
