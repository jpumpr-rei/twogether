"use client";

import { useState } from "react";
import { recategorize } from "../../transactions/actions";
import type { CategoryInfo } from "../../transactions/types";

export type RecategorizeTx = {
  id: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  category_id: string | null;
};

export default function RecategorizeSheet({
  tx,
  categories,
  onClose,
  onSaved,
}: {
  tx: RecategorizeTx;
  categories: CategoryInfo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(tx.category_id);
  const [applyToAll, setApplyToAll] = useState(false);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [saving, setSaving] = useState(false);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const currentCategory = categoryId ? (categoryMap.get(categoryId) ?? null) : null;

  // ── Category picker overlay ───────────────────────────────────────────────
  if (pickingCategory) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
        <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl z-[70] flex flex-col max-h-[88vh]">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-4 mb-1 flex-shrink-0" />
          <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0 border-b border-gray-50">
            <button
              onClick={() => setPickingCategory(false)}
              className="text-orange-500 font-medium text-sm hover:opacity-75 active:opacity-60"
            >
              ← Back
            </button>
            <p className="font-bold text-gray-900">Choose category</p>
          </div>
          <div className="overflow-y-auto flex-1 pb-safe divide-y divide-gray-50">
            <button
              onClick={() => { setCategoryId(null); setPickingCategory(false); }}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 active:bg-gray-50"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                ❓
              </div>
              <span className="flex-1 text-left text-sm font-medium text-gray-400">
                Uncategorized
              </span>
              {!categoryId && <span className="text-orange-500">✓</span>}
            </button>
            {categories.map((cat) => {
              const bg = cat.color ? cat.color + "22" : "#f3f4f6";
              return (
                <button
                  key={cat.id}
                  onClick={() => { setCategoryId(cat.id); setPickingCategory(false); }}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 active:bg-gray-50"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: bg }}
                  >
                    {cat.icon ?? "📦"}
                  </div>
                  <span className="flex-1 text-left text-sm font-medium text-gray-900">
                    {cat.name}
                  </span>
                  {categoryId === cat.id && <span className="text-orange-500">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ── Main sheet ────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      await recategorize(tx.id, categoryId, applyToAll, tx.merchant_name);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl z-[70] px-5 pt-4 pb-6 shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        {/* Transaction header */}
        <div className="flex items-start justify-between mb-1">
          <p className="font-bold text-gray-900 text-lg flex-1 pr-4 leading-snug">
            {tx.merchant_name ?? "Unknown merchant"}
          </p>
          <p className="font-bold text-xl text-gray-900 tabular-nums">
            ${Math.abs(tx.amount).toFixed(2)}
          </p>
        </div>
        <p className="text-sm text-gray-400 mb-5">{tx.date}</p>

        {/* Category picker */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Category
        </p>
        <button
          onClick={() => setPickingCategory(true)}
          className="w-full flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 mb-4 hover:bg-gray-200 active:bg-gray-100"
        >
          {currentCategory ? (
            <>
              <span className="text-xl">{currentCategory.icon ?? "📦"}</span>
              <span className="flex-1 text-left font-medium text-gray-900 text-sm">
                {currentCategory.name}
              </span>
            </>
          ) : (
            <>
              <span className="text-xl">❓</span>
              <span className="flex-1 text-left font-medium text-gray-400 text-sm">
                Uncategorized — tap to assign
              </span>
            </>
          )}
          <span className="text-gray-300 text-sm">›</span>
        </button>

        {/* Apply to all toggle */}
        {tx.merchant_name && (
          <button
            onClick={() => setApplyToAll((v) => !v)}
            className="w-full flex items-center gap-3 py-3 mb-4 hover:opacity-90 active:opacity-80"
          >
            {/* Toggle pill */}
            <div
              className={`w-12 h-7 rounded-full flex items-center px-0.5 flex-shrink-0 transition-colors duration-200 ${
                applyToAll ? "bg-orange-500" : "bg-gray-200"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
                  applyToAll ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-900">
                Apply to all {tx.merchant_name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Move every {tx.merchant_name} transaction to this category
              </p>
            </div>
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-orange-500 text-white font-semibold rounded-xl py-3.5 text-sm disabled:opacity-50 hover:bg-orange-600 active:bg-orange-600"
        >
          {saving ? "Saving…" : applyToAll ? `Move all ${tx.merchant_name ?? ""}` : "Save"}
        </button>
      </div>
    </>
  );
}
