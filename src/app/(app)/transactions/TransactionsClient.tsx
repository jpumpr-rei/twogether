"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import TransactionSheet from "./TransactionSheet";
import type { TxRow, CategoryInfo } from "./types";

export default function TransactionsClient({
  transactions,
  categories,
}: {
  transactions: TxRow[];
  categories: CategoryInfo[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  if (transactions.length === 0) {
    return (
      <div className="px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Transactions</h1>
        <div className="text-center py-20 text-gray-400 text-sm space-y-2">
          <p className="text-4xl">💳</p>
          <p>No transactions yet.</p>
          <p>Connect a bank card in Settings to get started.</p>
        </div>
      </div>
    );
  }

  const groups = groupByDate(transactions);

  return (
    <div className="px-4 pt-12 pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Transactions</h1>

      <div className="space-y-5">
        {groups.map(({ label, txs }) => (
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
    </div>
  );
}

function TxListRow({ tx, onTap }: { tx: TxRow; onTap: () => void }) {
  const hasSplits = tx.splits.length > 0;
  const category = tx.category;
  const isCredit = tx.amount < 0;

  // For split transactions, use the first split's category for the icon
  const displayCategory = hasSplits ? (tx.splits[0]?.category ?? null) : category;
  const iconBg = displayCategory?.color ? displayCategory.color + "22" : "#f3f4f6";

  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors"
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
            tx.splits
              .map((s) => s.category?.name ?? "Uncategorized")
              .join(" · ")
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
        : formatDate(date),
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
