"use client";

import { useRouter } from "next/navigation";
import type { AccountCardRow, AccountTxRow } from "./page";

export default function AccountDetailClient({
  card,
  transactions,
}: {
  card: AccountCardRow;
  transactions: AccountTxRow[];
}) {
  const router = useRouter();

  const groups = groupByDate(transactions);

  return (
    <div className="min-h-screen bg-gray-50">
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

      <div className="px-4 pt-4 pb-8 space-y-5">
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <p className="text-gray-400 text-sm">No transactions for this account.</p>
          </div>
        ) : (
          groups.map(({ label, txs }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {label}
              </p>
              <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
                {txs.map((tx) => {
                  const cat = tx.category;
                  const iconBg = cat?.color ? cat.color + "22" : "#f3f4f6";
                  const isCredit = tx.amount < 0;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
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
                        <p className="text-xs text-gray-400">
                          {cat?.name ?? (
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
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function groupByDate(txs: AccountTxRow[]): { label: string; txs: AccountTxRow[] }[] {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const map = new Map<string, AccountTxRow[]>();
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
