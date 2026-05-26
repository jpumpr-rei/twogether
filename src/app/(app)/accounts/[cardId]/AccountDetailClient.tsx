"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import TransactionSheet from "../../transactions/TransactionSheet";
import DateFilterSheet from "@/components/ui/DateFilterSheet";
import {
  dateFilterLabel,
  dateFilterToSearch,
  type DateFilter,
} from "@/lib/dateFilter";
import type { TxRow, CategoryInfo } from "../../transactions/types";
import type { AccountCardRow } from "./page";

export default function AccountDetailClient({
  card,
  transactions,
  categories,
  activeFilter,
  cardId,
}: {
  card: AccountCardRow;
  transactions: TxRow[];
  categories: CategoryInfo[];
  activeFilter: DateFilter;
  cardId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);
  const [search, setSearch] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function handleFilterSelect(filter: DateFilter) {
    setShowDateFilter(false);
    router.push(`/accounts/${cardId}${dateFilterToSearch(filter)}`);
  }

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) =>
      (tx.merchant_name ?? "").toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const dateLabel = dateFilterLabel(activeFilter);
  const isDateFiltered = activeFilter.type !== "all";

  const groups = groupByDate(filtered);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => router.back()}
          className="text-orange-500 font-medium text-base active:opacity-60 mr-1"
        >
          ← Back
        </button>
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
          💳
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 text-base leading-tight truncate">
            {card.account_name}
          </h1>
          <p className="text-xs text-gray-400 capitalize">
            {card.institution_name} · {card.account_type}
            {card.last_four && ` ·· ${card.last_four}`}
          </p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchants…"
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 active:text-gray-500 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* Date filter chip */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowDateFilter(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border shadow-sm active:opacity-80 ${
              isDateFiltered
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-white border-gray-200 text-gray-700"
            }`}
          >
            <span>📅</span>
            <span>{dateLabel}</span>
            {isDateFiltered ? (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFilterSelect({ type: "all" });
                }}
                className="opacity-80 hover:opacity-100 leading-none"
              >
                ×
              </span>
            ) : (
              <span className="text-gray-400 text-[10px]">▾</span>
            )}
          </button>
        </div>

        {/* Transaction list */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm mt-2">
            <p className="text-gray-400 text-sm">
              {search.trim() || isDateFiltered
                ? "No transactions match your filters."
                : "No transactions for this account."}
            </p>
          </div>
        ) : (
          <div className="space-y-5 pb-4">
            {groups.map(({ label, txs }) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  {label}
                </p>
                <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
                  {txs.map((tx) => {
                    const hasSplits = tx.splits.length > 0;
                    const cat = hasSplits ? (tx.splits[0]?.category ?? null) : tx.category;
                    const iconBg = cat?.color ? cat.color + "22" : "#f3f4f6";
                    const isCredit = tx.amount < 0;

                    return (
                      <button
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors"
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                          style={{ backgroundColor: iconBg }}
                        >
                          {cat?.icon ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate text-sm">
                            {tx.merchant_name ?? "Unknown merchant"}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {hasSplits ? (
                              tx.splits
                                .map((s) => s.category?.name ?? "Uncategorized")
                                .join(" · ")
                            ) : tx.category ? (
                              tx.category.name
                            ) : (
                              <span className="text-orange-400">Uncategorized</span>
                            )}
                            {tx.is_pending && (
                              <span className="ml-1 text-orange-400">· Pending</span>
                            )}
                          </p>
                        </div>
                        <span
                          className={`font-semibold text-sm tabular-nums flex-shrink-0 ${
                            isCredit ? "text-green-500" : "text-gray-800"
                          }`}
                        >
                          {isCredit ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                        </span>
                        <span className="text-gray-300 text-xs ml-1">›</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sheets */}
      {selectedTx && (
        <TransactionSheet
          tx={selectedTx}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onSaved={() => {
            setSelectedTx(null);
            refresh();
          }}
        />
      )}

      {showDateFilter && (
        <DateFilterSheet
          activeFilter={activeFilter}
          onSelect={handleFilterSelect}
          onClose={() => setShowDateFilter(false)}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function groupByDate(txs: TxRow[]): { label: string; txs: TxRow[] }[] {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const map = new Map<string, TxRow[]>();
  for (const tx of txs) {
    if (!map.has(tx.date)) map.set(tx.date, []);
    map.get(tx.date)!.push(tx);
  }

  return Array.from(map.entries()).map(([date, txs]) => ({
    label:
      date === today
        ? "Today"
        : date === yesterday
        ? "Yesterday"
        : new Date(date + "T00:00:00").toLocaleDateString("default", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
    txs,
  }));
}
