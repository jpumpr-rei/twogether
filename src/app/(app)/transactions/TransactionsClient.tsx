"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import TransactionSheet from "./TransactionSheet";
import DateFilterSheet from "@/components/ui/DateFilterSheet";
import {
  dateFilterLabel,
  dateFilterToSearch,
  type DateFilter,
} from "@/lib/dateFilter";
import type { TxRow, CategoryInfo, CardInfo } from "./types";
import SyncButton from "@/components/ui/SyncButton";

// ── Account filter sheet ──────────────────────────────────────────────────────
function AccountFilterSheet({
  cards,
  selectedIds,
  onToggle,
  onClearAll,
  onClose,
}: {
  cards: CardInfo[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl z-[70] flex flex-col max-h-[70vh]">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-4 mb-1 flex-shrink-0" />
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
          <p className="font-bold text-gray-900">Filter by account</p>
          {selectedIds.size > 0 && (
            <button
              onClick={onClearAll}
              className="text-orange-500 text-sm font-medium hover:opacity-75 active:opacity-60"
            >
              Show all
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50 pb-safe">
          {cards.map((card) => {
            const isSelected = selectedIds.has(card.id);
            return (
              <button
                key={card.id}
                onClick={() => onToggle(card.id)}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-50"
              >
                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected
                      ? "bg-orange-500 border-orange-500"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">{card.institution_name}</p>
                  <p className="text-xs text-gray-400">
                    {card.account_name ?? "Account"}
                    {card.last_four ? ` ·· ${card.last_four}` : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Transaction list row ──────────────────────────────────────────────────────
function TxListRow({ tx, onTap }: { tx: TxRow; onTap: () => void }) {
  const hasSplits = tx.splits.length > 0;
  const category = tx.category;
  const isCredit = tx.amount < 0;
  const displayCategory = hasSplits ? (tx.splits[0]?.category ?? null) : category;
  const iconBg = displayCategory?.color ? displayCategory.color + "22" : "#f3f4f6";

  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-50 transition-colors"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        {displayCategory?.icon ?? "📦"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate text-sm">
          {tx.merchant_name ?? "Unknown merchant"}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {hasSplits ? (
            tx.splits.map((s) => s.category?.name ?? "Uncategorized").join(" · ")
          ) : category ? (
            category.name
          ) : (
            <span className="text-orange-400">Uncategorized</span>
          )}
          {tx.is_pending && <span className="ml-1 text-orange-400">· Pending</span>}
        </p>
      </div>
      <span
        className={`font-semibold tabular-nums text-sm flex-shrink-0 ${
          isCredit ? "text-green-500" : "text-gray-800"
        }`}
      >
        {isCredit ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
      </span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TransactionsClient({
  transactions,
  categories,
  cards,
  activeFilter,
  lastSyncedAt,
}: {
  transactions: TxRow[];
  categories: CategoryInfo[];
  cards: CardInfo[];
  activeFilter: DateFilter;
  lastSyncedAt: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showAccountFilter, setShowAccountFilter] = useState(false);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function handleFilterSelect(filter: DateFilter) {
    setShowDateFilter(false);
    router.push(`/transactions${dateFilterToSearch(filter)}`);
  }

  function toggleCard(id: string) {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Client-side filtering (search + accounts)
  const filtered = useMemo(() => {
    let txs = transactions;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      txs = txs.filter((tx) => (tx.merchant_name ?? "").toLowerCase().includes(q));
    }
    if (selectedCardIds.size > 0) {
      txs = txs.filter((tx) => tx.card_id != null && selectedCardIds.has(tx.card_id));
    }
    return txs;
  }, [transactions, search, selectedCardIds]);

  // Chip labels
  const dateLabel = dateFilterLabel(activeFilter);
  const isDateFiltered = activeFilter.type !== "all";

  const accountsLabel =
    selectedCardIds.size === 0
      ? "All accounts"
      : selectedCardIds.size === 1
      ? (cards.find((c) => selectedCardIds.has(c.id))?.institution_name ?? "1 account")
      : `${selectedCardIds.size} accounts`;

  const hasActiveFilters = !!search.trim() || selectedCardIds.size > 0;

  return (
    <div className="px-4 pt-12 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <SyncButton lastSyncedAt={lastSyncedAt} onSynced={refresh} />
      </div>

      {/* Search */}
      <div className="relative mb-2">
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 active:text-gray-500 text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {/* Date */}
        <button
          onClick={() => setShowDateFilter(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border shadow-sm hover:opacity-90 active:opacity-80 ${
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
              onClick={(e) => { e.stopPropagation(); handleFilterSelect({ type: "all" }); }}
              className="opacity-80 hover:opacity-100 leading-none cursor-pointer"
            >
              ×
            </span>
          ) : (
            <span className="text-gray-400 text-[10px]">▾</span>
          )}
        </button>

        {/* Accounts */}
        {cards.length > 0 && (
          <button
            onClick={() => setShowAccountFilter(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border shadow-sm hover:opacity-90 active:opacity-80 ${
              selectedCardIds.size > 0
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-white border-gray-200 text-gray-700"
            }`}
          >
            <span>🏦</span>
            <span>{accountsLabel}</span>
            {selectedCardIds.size > 0 ? (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCardIds(new Set());
                }}
                className="opacity-80 hover:opacity-100 leading-none cursor-pointer"
              >
                ×
              </span>
            ) : (
              <span className="text-gray-400 text-[10px]">▾</span>
            )}
          </button>
        )}
      </div>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm space-y-3">
          <p className="text-3xl">{hasActiveFilters ? "🔍" : "💳"}</p>
          {hasActiveFilters ? (
            <p className="text-gray-500">No transactions match your filters.</p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-gray-500 font-medium">No transactions this month</p>
                <p className="text-xs">Banks can take a few minutes to load the first time.</p>
              </div>
              <SyncButton lastSyncedAt={lastSyncedAt} onSynced={refresh} />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groupByDate(filtered).map(({ label, txs }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {label}
              </p>
              <div className="bg-white rounded-2xl divide-y divide-gray-50 shadow-sm overflow-hidden">
                {txs.map((tx) => (
                  <TxListRow key={tx.id} tx={tx} onTap={() => setSelectedTx(tx)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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

      {showAccountFilter && (
        <AccountFilterSheet
          cards={cards}
          selectedIds={selectedCardIds}
          onToggle={toggleCard}
          onClearAll={() => setSelectedCardIds(new Set())}
          onClose={() => setShowAccountFilter(false)}
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
      date === today ? "Today" : date === yesterday ? "Yesterday" : formatDate(date),
    txs,
  }));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("default", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
