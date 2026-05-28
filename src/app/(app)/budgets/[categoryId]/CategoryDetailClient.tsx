"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import EditSheet from "../EditSheet";
import TransactionSheet from "../../transactions/TransactionSheet";
import { deleteCategory } from "./actions";
import {
  budgetPeriodLabel,
  budgetPeriodToSearch,
  normalizedBudgetAmount,
  prevPeriod,
  nextPeriod,
  rangeDays,
  type BudgetPeriod,
} from "@/lib/budgetPeriod";
import type { CategoryRow, BudgetRow } from "../types";
import type { CategoryInfo, TxRow } from "../../transactions/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const START_YEAR = 2023;
const LS_KEY = "twogether_budget_range";

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CategoryDetailClient({
  category,
  budget,
  transactions,
  allCategories,
  spent,
  activePeriod,
  splitAmountOverrides = {},
}: {
  category: CategoryRow;
  budget: BudgetRow | null;
  transactions: TxRow[];
  allCategories: CategoryInfo[];
  spent: number;
  activePeriod: BudgetPeriod;
  splitAmountOverrides?: Record<string, number>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYear  = now.getFullYear();
  const todayStr     = fmtDate(now);
  const defaultFrom  = fmtDate(new Date(now.getTime() - 29 * 86_400_000));
  const defaultTo    = todayStr;

  const [pickerYear, setPickerYear] = useState<number>(
    activePeriod.type === "month"
      ? parseInt(activePeriod.month.split("-")[0], 10)
      : activePeriod.type === "year"
      ? activePeriod.year
      : currentYear
  );
  const [lastMonth, setLastMonth] = useState<string>(
    activePeriod.type === "month" ? activePeriod.month : currentMonth
  );
  const [rangeFrom, setRangeFrom] = useState<string>(
    activePeriod.type === "range" ? activePeriod.from : defaultFrom
  );
  const [rangeTo, setRangeTo] = useState<string>(
    activePeriod.type === "range" ? activePeriod.to : defaultTo
  );

  useEffect(() => {
    if (activePeriod.type === "range") {
      setRangeFrom(activePeriod.from);
      setRangeTo(activePeriod.to);
    }
    if (activePeriod.type === "month") {
      setLastMonth(activePeriod.month);
    }
  }, [activePeriod]);

  const viewType = activePeriod.type;

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

  // Budget normalized to the active view period
  const displayBudget = budget
    ? normalizedBudgetAmount(budget.amount, budget.period, viewType, rangeCount)
    : 0;

  const pct      = budget && displayBudget > 0 ? Math.min(100, (spent / displayBudget) * 100) : 0;
  const isOver   = budget ? spent > displayBudget : false;
  const barColor = isOver ? "#f87171" : pct > 80 ? "#facc15" : "#fb923c";
  const iconBg   = category.color ? category.color + "22" : "#f3f4f6";
  const periodLabel = budgetPeriodLabel(activePeriod);

  function navigate(period: BudgetPeriod) {
    setShowPicker(false);
    if (period.type === "month") setLastMonth(period.month);
    startTransition(() =>
      router.push(`/budgets/${category.id}${budgetPeriodToSearch(period)}`)
    );
  }

  function switchView(type: "month" | "year" | "range") {
    if (type === viewType) return;
    if (type === "range") {
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
          : currentYear;
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
        : currentYear
    );
    setShowPicker(true);
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(false);
    try {
      await deleteCategory(category.id);
      router.push("/budgets");
    } catch {
      setDeleteError(true);
      setIsDeleting(false);
    }
  }

  const slot = { category, budget, spent };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => router.push("/budgets" + budgetPeriodToSearch(activePeriod))}
          className="text-orange-500 font-medium text-base hover:opacity-75 active:opacity-60 mr-1"
        >
          ← Back
        </button>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
          style={{ backgroundColor: iconBg }}
        >
          {category.icon ?? "📦"}
        </div>
        <h1 className="font-bold text-gray-900 text-lg flex-1 truncate">{category.name}</h1>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setShowEdit(true)}
            className="text-orange-500 font-medium text-sm hover:opacity-75 active:opacity-60"
          >
            {budget ? "Edit" : "Set budget"}
          </button>
          {!category.is_default && (
            <button
              onClick={() => { setShowDeleteConfirm(true); setDeleteError(false); }}
              className="text-red-400 font-medium text-sm hover:opacity-75 active:opacity-60"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Period controls */}
      <div className="bg-white border-b border-gray-100 px-4 pb-4 pt-3">
        {/* View toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-3">
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

        {/* Navigation row / date pickers */}
        {viewType === "range" ? (
          <div className="flex items-end gap-3">
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
          <div className="flex items-center justify-between">
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
              {periodLabel}
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
      </div>

      <div className="px-4 pt-4 space-y-4 pb-8">
        {/* Budget progress card */}
        {budget ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-baseline mb-3">
              <p className="text-sm text-gray-500 font-medium">{periodLabel} budget</p>
              <p className="font-bold text-gray-900 text-lg">
                ${displayBudget.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                {viewType !== "range" && (
                  <span className="text-sm font-normal text-gray-400 ml-1">
                    {viewType === "year" ? "/ yr" : "/ mo"}
                  </span>
                )}
              </p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
            <div className="flex justify-between">
              <p className="text-sm text-gray-500">
                ${spent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spent
              </p>
              <p className={`text-sm font-semibold ${isOver ? "text-red-500" : "text-gray-700"}`}>
                {isOver
                  ? `$${(spent - displayBudget).toLocaleString("en-US", { maximumFractionDigits: 2 })} over`
                  : `$${(displayBudget - spent).toLocaleString("en-US", { maximumFractionDigits: 2 })} remaining`}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 text-center">
            <p className="text-gray-600 text-sm mb-3">No budget set for this category.</p>
            <button
              onClick={() => setShowEdit(true)}
              className="bg-orange-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm hover:bg-orange-600 active:bg-orange-600"
            >
              Set a budget
            </button>
          </div>
        )}

        {/* Transactions */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
            {periodLabel} transactions
          </p>
          {transactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <p className="text-gray-400 text-sm">No transactions for this period.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
              {transactions.map((tx) => {
                const displayAmt = splitAmountOverrides[tx.id] ?? tx.amount;
                const isSplit = tx.id in splitAmountOverrides;
                const isCredit = displayAmt < 0;
                return (
                  <button
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-50 transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                      style={{ backgroundColor: iconBg }}
                    >
                      {category.icon ?? "📦"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {tx.merchant_name ?? "Unknown merchant"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {tx.date}
                        {tx.is_pending && <span className="ml-1 text-orange-400">· Pending</span>}
                        {isSplit && <span className="ml-1 text-blue-400">· Split</span>}
                      </p>
                    </div>
                    <span className={`font-semibold text-sm tabular-nums ${isCredit ? "text-green-500" : "text-gray-800"}`}>
                      {isCredit ? "+" : ""}${Math.abs(displayAmt).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-gray-300 text-xs ml-1">›</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <EditSheet
          slot={slot}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); refresh(); }}
        />
      )}

      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[60]"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          />
          <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl z-[70] px-5 pt-4 pb-10 shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-4"
              style={{ backgroundColor: iconBg }}
            >
              {category.icon ?? "📦"}
            </div>
            <h2 className="text-center font-bold text-gray-900 text-lg mb-1">
              Delete &ldquo;{category.name}&rdquo;?
            </h2>
            <p className="text-center text-sm text-gray-500 mb-1">
              All transactions in this category will become uncategorized.
            </p>
            <p className="text-center text-sm text-gray-500 mb-6">
              Any budget set for it will also be removed.
            </p>
            {deleteError && (
              <p className="text-center text-sm text-red-500 mb-4">
                Something went wrong — please try again.
              </p>
            )}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full bg-red-500 text-white font-semibold rounded-2xl py-3.5 text-base disabled:opacity-50 active:bg-red-600 mb-3"
            >
              {isDeleting ? "Deleting…" : "Delete category"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              className="w-full text-gray-500 font-medium py-2 text-sm disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {selectedTx && (
        <TransactionSheet
          tx={selectedTx}
          categories={allCategories}
          onClose={() => setSelectedTx(null)}
          onSaved={() => { setSelectedTx(null); refresh(); }}
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
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl shadow-xl pb-safe">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-4 pb-6">
          {viewType === "month" ? (
            <>
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
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {MONTHS.map((label, idx) => {
                  const monthNum  = String(idx + 1).padStart(2, "0");
                  const monthStr  = `${pickerYear}-${monthNum}`;
                  const isFuture  = monthStr > currentMonth;
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
