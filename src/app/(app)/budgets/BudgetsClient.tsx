"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EditSheet from "./EditSheet";
import type { BudgetSlot } from "./types";

export default function BudgetsClient({ slots }: { slots: BudgetSlot[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editingSlot, setEditingSlot] = useState<BudgetSlot | null>(null);

  const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });
  const totalBudget = slots.reduce((s, sl) => s + (sl.budget?.amount ?? 0), 0);

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="px-4 pt-12 pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Budgets</h1>
      <p className="text-sm text-gray-400 mb-1">{month}</p>
      <p className="text-3xl font-bold text-gray-900 mb-6">
        ${totalBudget.toLocaleString()}
        <span className="text-base font-normal text-gray-400"> / mo</span>
      </p>

      <div className="space-y-2">
        {slots.map((slot) => (
          <BudgetRow
            key={slot.category.id}
            slot={slot}
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
  onNavigate,
  onEdit,
}: {
  slot: BudgetSlot;
  onNavigate: () => void;
  onEdit: () => void;
}) {
  const { category, budget, spent } = slot;
  const hasbudget = budget != null;
  const pct = hasbudget ? Math.min(100, (spent / budget.amount) * 100) : 0;
  const isOver = hasbudget && spent > budget.amount;
  const barColor = isOver ? "#f87171" : pct > 80 ? "#facc15" : "#fb923c";
  const iconBg = category.color ? category.color + "22" : "#f3f4f6";

  return (
    <div className="relative bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Main tap area — navigates to category detail */}
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
            <p className={`font-semibold truncate ${hasbudget ? "text-gray-900" : "text-gray-400"}`}>
              {category.name}
            </p>
            {hasbudget && (
              <p className="text-xs text-gray-400 capitalize">{budget.period}</p>
            )}
          </div>
          {hasbudget ? (
            <span className="font-bold text-gray-900 tabular-nums">
              ${budget.amount.toLocaleString()}
            </span>
          ) : (
            <span className="text-sm text-orange-400 font-medium border border-orange-200 rounded-lg px-2.5 py-0.5">
              Set
            </span>
          )}
        </div>

        {hasbudget && (
          <div className="mt-3">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-400">${spent.toFixed(2)} spent</p>
              <p className={`text-xs font-medium ${isOver ? "text-red-500" : "text-gray-400"}`}>
                {isOver
                  ? `$${(spent - budget.amount).toFixed(2)} over`
                  : `$${(budget.amount - spent).toFixed(2)} left`}
              </p>
            </div>
          </div>
        )}
      </button>

      {/* Edit button — sits outside the main button to avoid nesting */}
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
