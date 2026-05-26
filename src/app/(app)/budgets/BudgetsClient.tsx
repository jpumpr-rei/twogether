"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import NewCategorySheet from "./NewCategorySheet";
import {
  budgetPeriodLabel,
  budgetPeriodToSearch,
  normalizedBudgetAmount,
  prevPeriod,
  nextPeriod,
  type BudgetPeriod,
} from "@/lib/budgetPeriod";
import type { BudgetSlot } from "./types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const START_YEAR = 2023;

export default function BudgetsClient({
  slots,
  activePeriod,
}: {
  slots: BudgetSlot[];
  activePeriod: BudgetPeriod;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // Year shown inside the monthly picker sheet
  const [pickerYear, setPickerYear] = useState<number>(
    activePeriod.type === "month"
      ? parseInt(activePeriod.month.split("-")[0], 10)
      : activePeriod.year
  );

  const viewType = activePeriod.type;
  const periodLabel = budgetPeriodLabel(activePeriod);
  const suffix = viewType === "year" ? "/ yr" : "/ mo";

  // Check if this period is in the future (disable next arrow)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYear = now.getFullYear();
  const isAtOrBeyondNow =
    viewType === "month"
      ? activePeriod.month >= currentMonth
      : activePeriod.year >= currentYear;

  const totalBudget = slots.reduce((sum, sl) => {
    if (!sl.budget) return sum;
    return sum + normalizedBudgetAmount(sl.budget.amount, sl.budget.period, viewType);
  }, 0);

  function navigate(period: BudgetPeriod) {
    setShowPicker(false);
    startTransition(() => router.push("/budgets" + budgetPeriodToSearch(period)));
  }

  function switchView(type: "month" | "year") {
    if (type === viewType) return;
    if (type === "year") {
      const year =
        activePeriod.type === "month"
          ? parseInt(activePeriod.month.split("-")[0], 10)
          : activePeriod.year;
      navigate({ type: "year", year });
    } else {
      // Switch to the first month of the current year period
      const year = activePeriod.type === "year" ? activePeriod.year : now.getFullYear();
      navigate({ type: "month", month: `${year}-01` });
    }
  }

  function openPicker() {
    // Reset picker year to match current active period
    setPickerYear(
      activePeriod.type === "month"
        ? parseInt(activePeriod.month.split("-")[0], 10)
        : activePeriod.year
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
      </div>

      {/* Period navigation */}
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

      {/* Total budget */}
      <p className="text-3xl font-bold text-gray-900 mb-6 text-center">
        ${totalBudget.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        <span className="text-base font-normal text-gray-400"> {suffix}</span>
      </p>

      <div className="space-y-2">
        {slots.map((slot) => (
          <BudgetRow
            key={slot.category.id}
            slot={slot}
            viewType={viewType}
            onNavigate={() => router.push(`/budgets/${slot.category.id}`)}
          />
        ))}

      </div>

      {showNewCategory && (
        <NewCategorySheet
          onClose={() => setShowNewCategory(false)}
          onSaved={() => { setShowNewCategory(false); refresh(); }}
        />
      )}

      {showPicker && (
        <PeriodPickerSheet
          viewType={viewType}
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
  const activeYear = activePeriod.type === "year" ? activePeriod.year : null;

  // All years from startYear to currentYear, newest first
  const years: number[] = [];
  for (let y = currentYear; y >= startYear; y--) years.push(y);

  return (
    <>
      {/* Backdrop — above tab bar (z-50) */}
      <div
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
      />

      {/* Sheet — above backdrop */}
      <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl shadow-xl pb-safe">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-4 pb-6">
          {viewType === "month" ? (
            <>
              {/* Year navigation row inside picker */}
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
              <p className="text-sm font-bold text-gray-800 py-3 border-b border-gray-100 mb-2">Select year</p>
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

function BudgetRow({
  slot,
  viewType,
  onNavigate,
}: {
  slot: BudgetSlot;
  viewType: "month" | "year";
  onNavigate: () => void;
}) {
  const { category, budget, spent } = slot;
  const hasBudget = budget != null;

  const displayAmount = hasBudget
    ? normalizedBudgetAmount(budget.amount, budget.period, viewType)
    : 0;

  const pct = hasBudget && displayAmount > 0
    ? Math.min(100, (spent / displayAmount) * 100)
    : 0;
  const isOver = hasBudget && displayAmount > 0 && spent > displayAmount;
  const barColor = isOver ? "#f87171" : pct > 80 ? "#facc15" : "#fb923c";
  const iconBg = category.color ? category.color + "22" : "#f3f4f6";

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
            <p className={`font-semibold truncate ${hasBudget ? "text-gray-900" : "text-gray-400"}`}>
              {category.name}
            </p>
            {hasBudget && (
              <p className="text-xs text-gray-400">
                {viewType === "year" ? "annual" : budget.period}
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
              <p className="text-xs text-gray-400">
                ${spent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spent
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
