"use client";

import { useState, useRef, useEffect } from "react";
import { setBudget, deleteBudget } from "./actions";
import type { BudgetSlot } from "./types";

export default function EditSheet({
  slot,
  onClose,
  onSaved,
}: {
  slot: BudgetSlot;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { category, budget } = slot;
  const [amount, setAmount] = useState(budget?.amount.toString() ?? "");
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">(
    (budget?.period as "weekly" | "monthly" | "yearly") ?? "monthly"
  );
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  async function handleSave() {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return;
    setSaving(true);
    await setBudget(category.id, category.name, parsed, period, budget?.id);
    onSaved();
  }

  async function handleDelete() {
    if (!budget) return;
    setSaving(true);
    await deleteBudget(budget.id);
    onSaved();
  }

  const iconBg = category.color ? category.color + "22" : "#f3f4f6";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl z-[70] px-6 pt-4 pb-safe shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: iconBg }}
          >
            {category.icon ?? "📦"}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{category.name}</p>
            <p className="text-sm text-gray-400">{budget ? "Edit budget" : "Set budget"}</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Amount
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-semibold">
                $
              </span>
              <input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="0"
                className="w-full rounded-xl border border-gray-200 pl-8 pr-4 py-3.5 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
              className="rounded-xl border border-gray-200 px-3 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !amount || parseFloat(amount) <= 0}
          className="w-full bg-orange-500 text-white font-semibold rounded-xl py-3.5 text-base disabled:opacity-50 active:bg-orange-600 mb-3"
        >
          {saving ? "Saving…" : budget ? "Update budget" : "Set budget"}
        </button>

        {budget && (
          <button
            onClick={handleDelete}
            disabled={saving}
            className="w-full text-red-500 font-medium py-2 text-sm active:bg-red-50 rounded-xl disabled:opacity-50"
          >
            Remove budget
          </button>
        )}
      </div>
    </>
  );
}
