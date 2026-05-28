"use client";

import { useState } from "react";
import { recategorize, saveSplits } from "./actions";
import type { TxRow, CategoryInfo } from "./types";

type SplitState = { category_id: string | null; amount: string };

export default function TransactionSheet({
  tx,
  categories,
  onClose,
  onSaved,
}: {
  tx: TxRow;
  categories: CategoryInfo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const hasSplits = tx.splits.length > 0;

  const [mode, setMode] = useState<"single" | "split">(hasSplits ? "split" : "single");
  const [categoryId, setCategoryId] = useState<string | null>(tx.category_id);
  const [applyToAll, setApplyToAll] = useState(false);
  const [splits, setSplits] = useState<SplitState[]>(
    hasSplits
      ? tx.splits.map((s) => ({ category_id: s.category_id, amount: s.amount.toFixed(2) }))
      : [
          { category_id: tx.category_id, amount: "" },
          { category_id: null, amount: "" },
        ]
  );
  // null = not picking; "single" = picking for single mode; number = picking for splits[n]
  const [pickingFor, setPickingFor] = useState<"single" | number | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const currentCategory = categoryId ? (categoryMap.get(categoryId) ?? null) : null;

  // Auto-calculate remainder for the last split row
  const definedSplits = splits.slice(0, -1);
  const sumDefined = definedSplits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0);
  const remainder = Math.round((Math.abs(tx.amount) - sumDefined) * 100) / 100;
  const isOverSplit = remainder < 0;

  function pickCategory(id: string | null) {
    if (pickingFor === "single") {
      setCategoryId(id);
    } else if (typeof pickingFor === "number") {
      setSplits((prev) =>
        prev.map((s, i) => (i === pickingFor ? { ...s, category_id: id } : s))
      );
    }
    setPickingFor(null);
  }

  function addSplit() {
    setSplits((prev) => {
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { category_id: null, amount: "" }, last];
    });
  }

  function removeSplit(index: number) {
    setSplits((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveSingle() {
    setSaving(true);
    await recategorize(tx.id, categoryId, applyToAll, tx.merchant_name ?? null);
    onSaved();
  }

  async function handleSaveSplits() {
    const finalSplits = [
      ...definedSplits.map((s) => ({
        category_id: s.category_id,
        amount: parseFloat(s.amount) || 0,
      })),
      { category_id: splits[splits.length - 1].category_id, amount: remainder },
    ];
    if (finalSplits.some((s) => s.amount <= 0)) return;
    setSaving(true);
    await saveSplits(tx.id, finalSplits);
    onSaved();
  }

  // ── Category picker overlay ──────────────────────────────────────────────
  if (pickingFor !== null) {
    const selectedId =
      pickingFor === "single" ? categoryId : splits[pickingFor as number]?.category_id;

    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
        <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl z-[70] flex flex-col max-h-[88vh]">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-4 mb-1 flex-shrink-0" />
          <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0 border-b border-gray-50">
            <button
              onClick={() => setPickingFor(null)}
              className="text-orange-500 font-medium text-sm hover:opacity-75 active:opacity-60"
            >
              ← Back
            </button>
            <p className="font-bold text-gray-900">Choose category</p>
          </div>
          <div className="overflow-y-auto flex-1 pb-safe divide-y divide-gray-50">
            <button
              onClick={() => pickCategory(null)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 active:bg-gray-50"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                ❓
              </div>
              <span className="flex-1 text-left text-sm font-medium text-gray-400">
                Uncategorized
              </span>
              {!selectedId && <span className="text-orange-500">✓</span>}
            </button>
            {categories.map((cat) => {
              const bg = cat.color ? cat.color + "22" : "#f3f4f6";
              return (
                <button
                  key={cat.id}
                  onClick={() => pickCategory(cat.id)}
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
                  {selectedId === cat.id && <span className="text-orange-500">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ── Main sheet ───────────────────────────────────────────────────────────
  const absAmount = Math.abs(tx.amount);
  const isCredit = tx.amount < 0;

  // Payment transactions: is_transfer with no explicit category and no splits
  const isPayment = tx.is_transfer && !tx.category && tx.splits.length === 0;
  // For payments, show the card's user-defined name (account_name) if set,
  // otherwise fall back to the institution name from Plaid
  const displayTitle = isPayment && tx.card
    ? tx.card.account_name ?? tx.card.institution_name
    : tx.merchant_name ?? "Unknown merchant";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl z-[70] px-5 pt-4 pb-10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        {/* Transaction header */}
        <div className="flex items-start justify-between mb-1">
          <p className="font-bold text-gray-900 text-lg flex-1 pr-4 leading-snug">
            {displayTitle}
          </p>
          <p className={`font-bold text-xl tabular-nums ${isCredit ? "text-green-500" : "text-gray-900"}`}>
            {isCredit ? "+" : ""}${absAmount.toFixed(2)}
          </p>
        </div>
        <p className="text-sm text-gray-400 mb-5">
          {tx.card && !isPayment
            ? `${tx.card.institution_name}${tx.card.last_four ? ` ·· ${tx.card.last_four}` : ""} · `
            : ""}
          {tx.date}
          {tx.is_pending && <span className="ml-1 text-orange-400">· Pending</span>}
        </p>

        {/* ── Single category mode ── */}
        {mode === "single" && (
          <>
            {/* Payment transactions: no category / split controls, just close */}
            {isPayment ? (
              <button
                onClick={onClose}
                className="w-full bg-gray-100 text-gray-700 font-semibold rounded-xl py-3.5 text-sm hover:bg-gray-200 active:bg-gray-200 mb-safe"
              >
                Close
              </button>
            ) : (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Category
                </p>
                <button
                  onClick={() => setPickingFor("single")}
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

                {tx.merchant_name && (
                  <button
                    onClick={() => setApplyToAll((v) => !v)}
                    className="w-full flex items-center gap-3 py-3 mb-1 hover:opacity-90 active:opacity-80"
                  >
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
                  onClick={() => setMode("split")}
                  className="w-full text-orange-500 font-medium text-sm py-2.5 border border-orange-200 rounded-xl hover:bg-orange-50 active:bg-orange-50 mb-3"
                >
                  Split transaction
                </button>

                <button
                  onClick={handleSaveSingle}
                  disabled={saving}
                  className="w-full bg-orange-500 text-white font-semibold rounded-xl py-3.5 text-sm disabled:opacity-50 hover:bg-orange-600 active:bg-orange-600 mb-safe"
                >
                  {saving ? "Saving…" : applyToAll ? `Move all ${tx.merchant_name ?? ""}` : "Done"}
                </button>
              </>
            )}
          </>
        )}

        {/* ── Split mode ── */}
        {mode === "split" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Split · ${absAmount.toFixed(2)} total
              </p>
              <button
                onClick={() => setMode("single")}
                className="text-xs text-gray-400 font-medium hover:opacity-75 active:opacity-60"
              >
                Don't split
              </button>
            </div>

            <div className="space-y-2 mb-2">
              {splits.map((split, i) => {
                const isLast = i === splits.length - 1;
                const cat = split.category_id ? (categoryMap.get(split.category_id) ?? null) : null;
                const bg = cat?.color ? cat.color + "22" : "#f3f4f6";

                return (
                  <div key={i} className="flex items-center gap-2">
                    {/* Category chip */}
                    <button
                      onClick={() => setPickingFor(i)}
                      className="flex items-center gap-2 flex-1 min-w-0 bg-gray-50 rounded-xl px-3 py-2.5 hover:bg-gray-200 active:bg-gray-100"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: bg }}
                      >
                        {cat?.icon ?? "❓"}
                      </div>
                      <span className="truncate text-sm font-medium text-gray-800 text-left">
                        {cat?.name ?? "Category"}
                      </span>
                    </button>

                    {/* Amount */}
                    {isLast ? (
                      <div
                        className={`w-[86px] px-3 py-2.5 rounded-xl text-right flex-shrink-0 ${
                          isOverSplit ? "bg-red-50" : "bg-gray-100"
                        }`}
                      >
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            isOverSplit ? "text-red-500" : "text-gray-500"
                          }`}
                        >
                          {isOverSplit ? `−$${Math.abs(remainder).toFixed(2)}` : `$${remainder.toFixed(2)}`}
                        </span>
                      </div>
                    ) : (
                      <div className="relative w-[86px] flex-shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={split.amount}
                          onChange={(e) =>
                            setSplits((prev) =>
                              prev.map((s, j) =>
                                j === i ? { ...s, amount: e.target.value } : s
                              )
                            )
                          }
                          placeholder="0"
                          className="w-full rounded-xl border border-gray-200 pl-6 pr-2 py-2.5 text-sm font-semibold text-right focus:outline-none focus:ring-2 focus:ring-orange-400 tabular-nums"
                        />
                      </div>
                    )}

                    {/* Remove button — only for non-last rows when we have > 2 */}
                    {!isLast && splits.length > 2 ? (
                      <button
                        onClick={() => removeSplit(i)}
                        className="text-gray-300 hover:text-red-400 active:text-red-400 w-6 text-xl leading-none flex-shrink-0"
                      >
                        ×
                      </button>
                    ) : (
                      <div className="w-6 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {isOverSplit && (
              <p className="text-xs text-red-500 text-center mb-2">
                Over by ${Math.abs(remainder).toFixed(2)} — reduce one of the amounts above
              </p>
            )}

            <button
              onClick={addSplit}
              className="w-full text-orange-500 text-sm font-medium py-2 hover:opacity-75 active:opacity-60 mb-3"
            >
              + Add split
            </button>

            <button
              onClick={handleSaveSplits}
              disabled={saving || isOverSplit || remainder === absAmount}
              className="w-full bg-orange-500 text-white font-semibold rounded-xl py-3.5 text-sm disabled:opacity-50 hover:bg-orange-600 active:bg-orange-600 mb-safe"
            >
              {saving ? "Saving…" : "Save splits"}
            </button>
          </>
        )}

        <div className="h-safe" />
      </div>
    </>
  );
}
