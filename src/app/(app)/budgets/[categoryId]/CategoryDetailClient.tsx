"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EditSheet from "../EditSheet";
import RecategorizeSheet from "./RecategorizeSheet";
import type { CategoryRow, BudgetRow } from "../types";
import type { CategoryInfo } from "../../transactions/types";
import type { TxRow } from "./page";

export default function CategoryDetailClient({
  category,
  budget,
  transactions,
  allCategories,
  spent,
}: {
  category: CategoryRow;
  budget: BudgetRow | null;
  transactions: TxRow[];
  allCategories: CategoryInfo[];
  spent: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);

  const iconBg = category.color ? category.color + "22" : "#f3f4f6";
  const pct = budget ? Math.min(100, (spent / budget.amount) * 100) : 0;
  const isOver = budget ? spent > budget.amount : false;
  const barColor = isOver ? "#f87171" : pct > 80 ? "#facc15" : "#fb923c";
  const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  const slot = { category, budget, spent };

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => router.back()}
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
        <button
          onClick={() => setShowEdit(true)}
          className="text-orange-500 font-medium text-sm hover:opacity-75 active:opacity-60"
        >
          {budget ? "Edit" : "Set budget"}
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-8">
        {/* Budget progress card */}
        {budget ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-baseline mb-3">
              <p className="text-sm text-gray-500 font-medium">{month} budget</p>
              <p className="font-bold text-gray-900 text-lg">
                ${budget.amount.toLocaleString()}
                <span className="text-sm font-normal text-gray-400 ml-1 capitalize">
                  / {budget.period}
                </span>
              </p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
            <div className="flex justify-between">
              <p className="text-sm text-gray-500">${spent.toFixed(2)} spent</p>
              <p className={`text-sm font-semibold ${isOver ? "text-red-500" : "text-gray-700"}`}>
                {isOver
                  ? `$${(spent - budget.amount).toFixed(2)} over budget`
                  : `$${(budget.amount - spent).toFixed(2)} remaining`}
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
            {month} transactions
          </p>
          {transactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <p className="text-gray-400 text-sm">No transactions this month.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
              {transactions.map((tx) => (
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
                    </p>
                  </div>
                  <span className="font-semibold text-gray-800 text-sm tabular-nums">
                    ${tx.amount.toFixed(2)}
                  </span>
                  <span className="text-gray-300 text-xs ml-1">›</span>
                </button>
              ))}
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

      {selectedTx && (
        <RecategorizeSheet
          tx={selectedTx}
          categories={allCategories}
          onClose={() => setSelectedTx(null)}
          onSaved={() => { setSelectedTx(null); refresh(); }}
        />
      )}
    </div>
  );
}
