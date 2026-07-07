"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import NewCategorySheet from "./NewCategorySheet";
import {
  budgetPeriodLabel,
  budgetPeriodToSearch,
  normalizedBudgetAmount,
  prevPeriod,
  nextPeriod,
  rangeDays,
  type BudgetPeriod,
} from "@/lib/budgetPeriod";
import type { BudgetSlot } from "./types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const START_YEAR = 2023;
const LS_KEY = "twogether_budget_range";

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BudgetsClient({
  slots,
  activePeriod,
  totalSpent,
  prevSpent,
  yoySpent,
}: {
  slots: BudgetSlot[];
  activePeriod: BudgetPeriod;
  totalSpent: number;
  prevSpent: number | null;
  yoySpent: number | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(
    activePeriod.type === "month"
      ? parseInt(activePeriod.month.split("-")[0], 10)
      : activePeriod.type === "year"
      ? activePeriod.year
      : new Date().getFullYear()
  );

  // Compute defaults once (at mount time)
  const now = new Date();
  const defaultTo   = fmtDate(now);
  const defaultFrom = fmtDate(new Date(now.getTime() - 29 * 86_400_000));
  const todayStr    = defaultTo;

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYear  = now.getFullYear();

  // Controlled date range inputs (driven by URL when in range view)
  const [rangeFrom, setRangeFrom] = useState<string>(
    activePeriod.type === "range" ? activePeriod.from : defaultFrom
  );
  const [rangeTo, setRangeTo] = useState<string>(
    activePeriod.type === "range" ? activePeriod.to : defaultTo
  );
  // Remember the last-visited month so switching back to Monthly doesn't reset to January
  const [lastMonth, setLastMonth] = useState<string>(
    activePeriod.type === "month" ? activePeriod.month : currentMonth
  );

  // Keep inputs in sync when URL changes (e.g. browser back/forward)
  useEffect(() => {
    if (activePeriod.type === "range") {
      setRangeFrom(activePeriod.from);
      setRangeTo(activePeriod.to);
    }
    if (activePeriod.type === "month") {
      setLastMonth(activePeriod.month);
    }
  }, [activePeriod]);

  const viewType = activePeriod.type; // "month" | "year" | "range"
  const suffix   = viewType === "year" ? "/ yr" : viewType === "range" ? "" : "/ mo";

  const isAtOrBeyondNow =
    viewType === "month" && activePeriod.type === "month"
      ? activePeriod.month >= currentMonth
      : viewType === "year" && activePeriod.type === "year"
      ? activePeriod.year >= currentYear
      : false;

  const rangeCount =
    activePeriod.type === "range"
      ? rangeDays(activePeriod.from, activePeriod.to)
      : undefined;

  const totalBudget = slots.reduce((sum, sl) => {
    if (!sl.budget) return sum;
    return sum + normalizedBudgetAmount(sl.budget.amount, sl.budget.period, viewType, rangeCount);
  }, 0);

  function navigate(period: BudgetPeriod) {
    setShowPicker(false);
    if (period.type === "month") setLastMonth(period.month);
    startTransition(() => router.push("/budgets" + budgetPeriodToSearch(period)));
  }

  function switchView(type: "month" | "year" | "range") {
    if (type === viewType) return;
    if (type === "range") {
      // Read saved range from localStorage or fall back to last 30 days
      let from = defaultFrom;
      let to   = defaultTo;
      try {
        const stored = JSON.parse(localStorage.getItem(LS_KEY) ?? "null");
        if (stored?.from && /^\d{4}-\d{2}-\d{2}$/.test(stored.from)) from = stored.from;
        if (stored?.to   && /^\d{4}-\d{2}-\d{2}$/.test(stored.to))   to   = stored.to;
      } catch { /* ignore */ }
      navigate({ type: "range", from, to });
      return;
    }
    if (type === "year") {
      const year =
        activePeriod.type === "month"
          ? parseInt(activePeriod.month.split("-")[0], 10)
          : activePeriod.type === "year"
          ? activePeriod.year
          : now.getFullYear();
      navigate({ type: "year", year });
    } else {
      navigate({ type: "month", month: lastMonth });
    }
  }

  function handleRangeChange(field: "from" | "to", value: string) {
    const newFrom = field === "from" ? value : rangeFrom;
    const newTo   = field === "to"   ? value : rangeTo;
    if (field === "from") setRangeFrom(value);
    else setRangeTo(value);

    // Navigate + persist once both dates are valid and ordered
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(newFrom) &&
      /^\d{4}-\d{2}-\d{2}$/.test(newTo) &&
      newFrom <= newTo
    ) {
      try { localStorage.setItem(LS_KEY, JSON.stringify({ from: newFrom, to: newTo })); } catch { /* ignore */ }
      navigate({ type: "range", from: newFrom, to: newTo });
    }
  }

  function openPicker() {
    setPickerYear(
      activePeriod.type === "month"
        ? parseInt(activePeriod.month.split("-")[0], 10)
        : activePeriod.type === "year"
        ? activePeriod.year
        : now.getFullYear()
    );
    setShowPicker(true);
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="px-4 pt-12 pb-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
        <button
          onClick={() => setShowNewCategory(true)}
          className="bg-orange-500 text-white text-sm font-semibold rounded-xl px-4 py-2 hover:bg-orange-600 active:bg-orange-600"
        >
          Add Category
        </button>
      </div>

      {/* View type toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => switchView("month")}
          className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            viewType === "month"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => switchView("year")}
          className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            viewType === "year"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Yearly
        </button>
        <button
          onClick={() => switchView("range")}
          className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            viewType === "range"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Date Range
        </button>
      </div>

      {/* Range date pickers OR month/year navigation */}
      {viewType === "range" ? (
        <div className="flex items-end gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1">From</label>
            <input
              type="date"
              value={rangeFrom}
              max={rangeTo}
              onChange={(e) => handleRangeChange("from", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1">To</label>
            <input
              type="date"
              value={rangeTo}
              min={rangeFrom}
              max={todayStr}
              onChange={(e) => handleRangeChange("to", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => navigate(prevPeriod(activePeriod))}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 text-lg font-medium"
            aria-label="Previous period"
          >
            ‹
          </button>
          <button
            onClick={openPicker}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Open period picker"
          >
            {budgetPeriodLabel(activePeriod)}
            <span className="text-gray-400 text-xs">▾</span>
          </button>
          <button
            onClick={() => !isAtOrBeyondNow && navigate(nextPeriod(activePeriod))}
            disabled={isAtOrBeyondNow}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-25 text-lg font-medium"
            aria-label="Next period"
          >
            ›
          </button>
        </div>
      )}

      {/* Total summary: spent + budgeted + variance */}
      <div className="text-center mb-6">
        <div className="flex items-baseline justify-center gap-1.5">
          <span className="text-3xl font-bold text-gray-900">
            ${totalSpent.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-sm text-gray-400">spent</span>
        </div>
        {totalBudget > 0 && (
          <p className="text-sm text-gray-400 mt-0.5">
            of ${totalBudget.toLocaleString("en-US", { maximumFractionDigits: 0 })} budgeted
            {suffix ? ` ${suffix}` : ""}
          </p>
        )}
        {(prevSpent !== null || yoySpent !== null) && (() => {
          const { prevLabel, yoyLabel } = varianceLabels(activePeriod);
          return (
            <div className="flex justify-center gap-2 mt-3 flex-wrap">
              {prevSpent !== null && (
                <VarianceChip current={totalSpent} prev={prevSpent} label={prevLabel} />
              )}
              {yoySpent !== null && yoyLabel && (
                <VarianceChip current={totalSpent} prev={yoySpent} label={yoyLabel} />
              )}
            </div>
          );
        })()}
      </div>

      <div className="space-y-2">
        {slots.map((slot) => (
          <BudgetRow
            key={slot.category.id}
            slot={slot}
            viewType={viewType}
            rangeCount={rangeCount}
            onNavigate={() => router.push(`/budgets/${slot.category.id}${budgetPeriodToSearch(activePeriod)}`)}
          />
        ))}
      </div>

      {showNewCategory && (
        <NewCategorySheet
          onClose={() => setShowNewCategory(false)}
          onSaved={() => { setShowNewCategory(false); refresh(); }}
        />
      )}

      {showPicker && viewType !== "range" && (
        <PeriodPickerSheet
          viewType={viewType as "month" | "year"}
          activePeriod={activePeriod}
          pickerYear={pickerYear}
          currentMonth={currentMonth}
          currentYear={currentYear}
          startYear={START_YEAR}
          onPickerYearChange={setPickerYear}
          onSelect={navigate}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ── Variance helpers ─────────────────────────────────────────────────────────

function varianceLabels(period: BudgetPeriod): { prevLabel: string; yoyLabel: string | null } {
  if (period.type === "month") {
    const [y, m] = period.month.split("-").map(Number);
    const prevD = new Date(y, m - 2, 1);
    const pY = prevD.getFullYear(), pM = prevD.getMonth(); // 0-indexed for MONTHS[]
    const prevLabel = pY !== y
      ? `${MONTHS[pM].slice(0, 3)} '${String(pY).slice(2)}`
      : MONTHS[pM].slice(0, 3);
    const yoyLabel = `${MONTHS[m - 1].slice(0, 3)} '${String(y - 1).slice(2)}`;
    return { prevLabel, yoyLabel };
  }
  if (period.type === "year") {
    return { prevLabel: String(period.year - 1), yoyLabel: null };
  }
  return { prevLabel: "prev period", yoyLabel: "last year" };
}

function VarianceChip({ current, prev, label }: { current: number; prev: number; label: string }) {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) {
    return (
      <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-xs font-medium text-gray-500">
        New · {label}
      </span>
    );
  }
  const pct = ((current - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
      up ? "bg-orange-50 text-orange-500" : "bg-green-50 text-green-600"
    }`}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(0)}% vs {label}
    </span>
  );
}

// ── Period Picker Sheet ───────────────────────────────────────────────────────

function PeriodPickerSheet({
  viewType,
  activePeriod,
  pickerYear,
  currentMonth,
  currentYear,
  startYear,
  onPickerYearChange,
  onSelect,
  onClose,
}: {
  viewType: "month" | "year";
  activePeriod: BudgetPeriod;
  pickerYear: number;
  currentMonth: string;
  currentYear: number;
  startYear: number;
  onPickerYearChange: (y: number) => void;
  onSelect: (period: BudgetPeriod) => void;
  onClose: () => void;
}) {
  const activeMonthStr = activePeriod.type === "month" ? activePeriod.month : null;
  const activeYear     = activePeriod.type === "year"  ? activePeriod.year  : null;

  const years: number[] = [];
  for (let y = currentYear; y >= startYear; y--) years.push(y);

  return (
    <>
      {/* Backdrop — above tab bar (z-50) */}
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl shadow-xl pb-safe">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-4 pb-6">
          {viewType === "month" ? (
            <>
              {/* Year navigation row */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100 mb-2">
                <button
                  onClick={() => onPickerYearChange(pickerYear - 1)}
                  disabled={pickerYear <= startYear}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-25 text-lg font-medium"
                  aria-label="Previous year"
                >
                  ‹
                </button>
                <span className="text-sm font-bold text-gray-800">{pickerYear}</span>
                <button
                  onClick={() => onPickerYearChange(pickerYear + 1)}
                  disabled={pickerYear >= currentYear}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-25 text-lg font-medium"
                  aria-label="Next year"
                >
                  ›
                </button>
              </div>

              {/* Month list */}
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {MONTHS.map((label, idx) => {
                  const monthNum = String(idx + 1).padStart(2, "0");
                  const monthStr = `${pickerYear}-${monthNum}`;
                  const isFuture = monthStr > currentMonth;
                  const isSelected = activeMonthStr === monthStr;
                  return (
                    <button
                      key={monthStr}
                      onClick={() => !isFuture && onSelect({ type: "month", month: monthStr })}
                      disabled={isFuture}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                        isSelected
                          ? "bg-orange-500 text-white"
                          : isFuture
                          ? "text-gray-300 cursor-default"
                          : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-gray-800 py-3 border-b border-gray-100 mb-2">
                Select year
              </p>
              {/* Year list */}
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {years.map((y) => {
                  const isSelected = activeYear === y;
                  return (
                    <button
                      key={y}
                      onClick={() => onSelect({ type: "year", year: y })}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                        isSelected
                          ? "bg-orange-500 text-white"
                          : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
                      }`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Budget Row ────────────────────────────────────────────────────────────────

function BudgetRow({
  slot,
  viewType,
  rangeCount,
  onNavigate,
}: {
  slot: BudgetSlot;
  viewType: "month" | "year" | "range";
  rangeCount?: number;
  onNavigate: () => void;
}) {
  const { category, budget, spent } = slot;
  const hasBudget = budget != null;
  const hasSpend  = spent !== 0;

  const displayAmount = hasBudget
    ? normalizedBudgetAmount(budget.amount, budget.period, viewType, rangeCount)
    : 0;

  const pct      = hasBudget && displayAmount > 0 ? Math.max(0, Math.min(100, (spent / displayAmount) * 100)) : 0;
  const isOver   = hasBudget && displayAmount > 0 && spent > displayAmount;
  const barColor = isOver ? "#f87171" : pct > 80 ? "#facc15" : "#fb923c";
  const iconBg   = category.color ? category.color + "22" : "#f3f4f6";

  // A category with no budget but real spending: show as active, no bar, no budget amount
  const spendOnly = !hasBudget && hasSpend;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={onNavigate}
        className="w-full px-4 pt-3 pb-3 text-left hover:bg-gray-50 active:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
            style={{ backgroundColor: iconBg }}
          >
            {category.icon ?? "📦"}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold truncate ${hasBudget || spendOnly ? "text-gray-900" : "text-gray-400"}`}>
              {category.name}
            </p>
            {hasBudget && (
              <p className="text-xs text-gray-400">
                {viewType === "year" ? "annual" : budget.period}
              </p>
            )}
            {spendOnly && (
              <p className={`text-xs ${spent < 0 ? "text-green-500" : "text-gray-400"}`}>
                {spent < 0
                  ? `$${Math.abs(spent).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} refunded`
                  : `$${spent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spent`}
              </p>
            )}
          </div>
          {hasBudget ? (
            <span className="font-bold text-gray-900 tabular-nums">
              ${displayAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          ) : (
            <span className="text-sm text-orange-400 font-medium border border-orange-200 rounded-lg px-2.5 py-0.5">
              Set
            </span>
          )}
        </div>

        {hasBudget && (
          <div className="mt-3">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <p className={`text-xs ${spent < 0 ? "text-green-500" : "text-gray-400"}`}>
                {spent < 0
                  ? `$${Math.abs(spent).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} refunded`
                  : `$${spent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spent`}
              </p>
              <p className={`text-xs font-medium ${isOver ? "text-red-500" : "text-gray-400"}`}>
                {isOver
                  ? `$${(spent - displayAmount).toLocaleString("en-US", { maximumFractionDigits: 2 })} over`
                  : `$${(displayAmount - spent).toLocaleString("en-US", { maximumFractionDigits: 2 })} left`}
              </p>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
