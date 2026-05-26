"use client";

import { useState, useMemo } from "react";
export type { DateFilter } from "@/lib/dateFilter";
import { dateFilterLabel } from "@/lib/dateFilter";
import type { DateFilter } from "@/lib/dateFilter";

// ── Component ─────────────────────────────────────────────────────────────────
export default function DateFilterSheet({
  activeFilter,
  onSelect,
  onClose,
}: {
  activeFilter: DateFilter;
  onSelect: (filter: DateFilter) => void;
  onClose: () => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(
    activeFilter.type === "range" ? activeFilter.from : ""
  );
  const [customTo, setCustomTo] = useState(
    activeFilter.type === "range" ? activeFilter.to : ""
  );

  const months = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 0; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "long", year: "numeric" });
      result.push({ value, label });
    }
    return result;
  }, []);

  const activeMonthValue = activeFilter.type === "month" ? activeFilter.month : null;

  // ── Custom range sub-view ──────────────────────────────────────────────────
  if (showCustom) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
        <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl z-[70] px-5 pt-4 pb-8 shadow-2xl">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => setShowCustom(false)}
              className="text-orange-500 font-medium text-sm active:opacity-60"
            >
              ← Back
            </button>
            <p className="font-bold text-gray-900">Custom range</p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                End date
              </label>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
              />
            </div>
          </div>

          <button
            onClick={() => {
              if (customFrom && customTo) {
                onSelect({ type: "range", from: customFrom, to: customTo });
              }
            }}
            disabled={!customFrom || !customTo || customFrom > customTo}
            className="w-full bg-orange-500 text-white font-semibold rounded-xl py-3.5 text-sm disabled:opacity-50 active:bg-orange-600"
          >
            Apply range
          </button>
        </div>
      </>
    );
  }

  // ── Main list ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl z-[70] flex flex-col max-h-[72vh]">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-4 mb-1 flex-shrink-0" />
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <p className="font-bold text-gray-900">Filter by date</p>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50 pb-safe">
          {/* All time */}
          <button
            onClick={() => onSelect({ type: "all" })}
            className="w-full px-5 py-4 flex items-center justify-between active:bg-gray-50"
          >
            <span
              className={`text-sm font-medium ${
                activeFilter.type === "all" ? "text-orange-500" : "text-gray-900"
              }`}
            >
              All transactions
            </span>
            {activeFilter.type === "all" && (
              <span className="text-orange-500 font-semibold">✓</span>
            )}
          </button>

          {/* Custom range */}
          <button
            onClick={() => setShowCustom(true)}
            className="w-full px-5 py-4 flex items-center justify-between active:bg-gray-50"
          >
            <span
              className={`text-sm font-medium ${
                activeFilter.type === "range" ? "text-orange-500" : "text-gray-900"
              }`}
            >
              {activeFilter.type === "range"
                ? dateFilterLabel(activeFilter)
                : "Custom range…"}
            </span>
            <span className="text-gray-400 text-xs">›</span>
          </button>

          {/* Months */}
          {months.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onSelect({ type: "month", month: value })}
              className="w-full px-5 py-4 flex items-center justify-between active:bg-gray-50"
            >
              <span
                className={`text-sm font-medium ${
                  value === activeMonthValue ? "text-orange-500" : "text-gray-900"
                }`}
              >
                {label}
              </span>
              {value === activeMonthValue && (
                <span className="text-orange-500 font-semibold">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
