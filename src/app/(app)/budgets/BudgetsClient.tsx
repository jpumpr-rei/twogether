"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EditSheet from "./EditSheet";
import {
  budgetPeriodLabel,
  budgetPeriodToSearch,
  normalizedBudgetAmount,
  prevPeriod,
  nextPeriod,
  type BudgetPeriod,
} from "@/lib/budgetPeriod";
import type { BudgetSlot } from "./types";

export default function BudgetsClient({
  slots,
  activePeriod,
}: {
  slots: BudgetSlot[];
  activePeriod: BudgetPeriod;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editingSlot, setEditingSlot] = useState<BudgetSlot | null>(null);

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

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="px-4 pt-12 pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Budgets</h1>

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
        <p className="text-sm font-semibold text-gray-600">{periodLabel}</p>
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
            onEdit={() => setEditingSlot(slot)}
          />
        ))}
      </div>

      {editingSlot && (
        <EditSheet
          slot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onSaved={() => { setEditingSlot(null); refresh(); }}
        />
      )}
    </div>
  );
}

function BudgetRow({
  slot,
  viewType,
  onNavigate,
  onEdit,
}: {
  slot: BudgetSlot;
  viewType: "month" | "year";
  onNavigate: () => void;
  onEdit: () => void;
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
    <div className="relative bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={onNavigate}
        className="w-full px-4 pt-3 pb-3 text-left hover:bg-gray-50 active:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 pr-8">
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

      <button
        onClick={onEdit}
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 active:text-gray-500 rounded-full hover:bg-gray-100 active:bg-gray-100"
        aria-label="Edit budget"
      >
        <span className="text-lg leading-none tracking-tighter">···</span>
      </button>
    </div>
  );
}
