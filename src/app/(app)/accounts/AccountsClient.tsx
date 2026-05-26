"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PlaidConnectButton from "@/components/ui/PlaidConnectButton";
import EditAccountNameSheet from "./EditAccountNameSheet";
import { removeCard } from "./actions";

export type CardDisplay = {
  id: string;
  owner_id: string;
  institution_name: string;
  account_name: string;
  last_four: string | null;
  account_type: string;
  balance_current: number | null;
  is_private: boolean;
};

export default function AccountsClient({
  initialCards,
  currentUserId,
  ownerNames,
}: {
  initialCards: CardDisplay[];
  currentUserId: string;
  ownerNames: Record<string, string>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [cards, setCards] = useState(initialCards);
  const [editingCard, setEditingCard] = useState<CardDisplay | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function handleNameSaved(cardId: string, newName: string, isPrivate: boolean) {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, account_name: newName, is_private: isPrivate } : c))
    );
    setEditingCard(null);
    refresh();
  }

  async function handleRemove(cardId: string) {
    setRemoving(cardId);
    try {
      await removeCard(cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      setConfirmRemoveId(null);
      refresh();
    } finally {
      setRemoving(null);
    }
  }

  function ownerLabel(card: CardDisplay): string {
    if (card.owner_id === currentUserId) return "Mine";
    return ownerNames[card.owner_id] ?? "Partner";
  }

  // Total net balance (depository positive, credit negative)
  const hasBalances = cards.some((c) => c.balance_current !== null);
  const totalBalance = cards.reduce((sum, card) => {
    if (card.balance_current === null) return sum;
    const isCredit = card.account_type === "credit" || card.account_type === "credit card";
    return sum + (isCredit ? -card.balance_current : card.balance_current);
  }, 0);

  // Group by institution
  const institutions = new Map<string, CardDisplay[]>();
  for (const card of cards) {
    const arr = institutions.get(card.institution_name) ?? [];
    arr.push(card);
    institutions.set(card.institution_name, arr);
  }

  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
        <PlaidConnectButton label="Add Account" compact />
      </div>

      {/* Total balance */}
      {hasBalances && cards.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-gray-400 mt-0.5">
            Net balance{" "}
            <span className={`font-semibold tabular-nums ${totalBalance < 0 ? "text-red-500" : "text-gray-700"}`}>
              {totalBalance < 0 ? "-" : ""}$
              {Math.abs(totalBalance).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm space-y-2 mt-4">
          <p className="text-4xl">🏦</p>
          <p>No accounts connected yet.</p>
          <p>Tap Add Account to link your first bank.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(institutions.entries()).map(([institution, accts]) => (
            <div key={institution}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {institution}
              </p>
              <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
                {accts.map((card) => {
                  const isCredit =
                    card.account_type === "credit" || card.account_type === "credit card";
                  const raw = card.balance_current;
                  const displayAmount = raw !== null ? (isCredit ? -raw : raw) : null;
                  const isNegative = displayAmount !== null && displayAmount < 0;
                  const isConfirming = confirmRemoveId === card.id;

                  if (isConfirming) {
                    return (
                      <div key={card.id} className="px-4 py-4 flex items-center justify-between gap-3">
                        <p className="text-sm text-gray-700 flex-1 min-w-0 truncate">
                          Remove <span className="font-medium">{card.account_name}</span>?
                        </p>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <button
                            onClick={() => setConfirmRemoveId(null)}
                            className="text-sm text-gray-400 font-medium hover:opacity-75 active:opacity-60"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRemove(card.id)}
                            disabled={removing === card.id}
                            className="text-sm text-red-500 font-semibold hover:opacity-75 active:opacity-60 disabled:opacity-40"
                          >
                            {removing === card.id ? "Removing…" : "Remove"}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={card.id} className="flex items-center gap-3 px-4 py-3">
                      {/* Navigate to account detail */}
                      <Link
                        href={`/accounts/${card.id}`}
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 active:opacity-70"
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                          💳
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-900 text-sm truncate">
                              {card.account_name}
                            </p>
                            {card.is_private && (
                              <span className="text-[10px] font-semibold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                Private
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 capitalize">
                            {card.account_type}
                            {card.last_four && ` ·· ${card.last_four}`}
                            {" · "}
                            <span className="text-gray-500 font-medium">{ownerLabel(card)}</span>
                          </p>
                        </div>
                      </Link>

                      {/* Balance */}
                      <div className="text-right flex-shrink-0">
                        {displayAmount !== null ? (
                          <>
                            <p
                              className={`font-bold text-sm tabular-nums ${
                                isNegative ? "text-red-500" : "text-gray-900"
                              }`}
                            >
                              {isNegative ? "-" : ""}$
                              {Math.abs(displayAmount).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-300">—</p>
                        )}
                      </div>

                      {/* Edit & Remove */}
                      <button
                        onClick={() => setEditingCard(card)}
                        className="text-gray-300 hover:text-orange-500 active:text-orange-500 p-1 flex-shrink-0"
                        aria-label="Edit account name"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setConfirmRemoveId(card.id)}
                        className="text-gray-300 hover:text-red-400 active:text-red-400 p-1 flex-shrink-0"
                        aria-label="Remove account"
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingCard && (
        <EditAccountNameSheet
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSaved={(name, isPrivate) => handleNameSaved(editingCard.id, name, isPrivate)}
        />
      )}
    </>
  );
}
