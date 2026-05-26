"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateAccountName } from "./actions";

export type CardDisplay = {
  id: string;
  institution_name: string;
  account_name: string;
  last_four: string | null;
  account_type: string;
  balance_current: number | null;
};

function EditNameSheet({
  card,
  onClose,
  onSaved,
}: {
  card: CardDisplay;
  onClose: () => void;
  onSaved: (newName: string) => void;
}) {
  const [name, setName] = useState(card.account_name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateAccountName(card.id, name);
      onSaved(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl z-[70] px-5 pt-4 pb-8 shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <p className="font-bold text-gray-900 text-base mb-1">Edit account name</p>
        <p className="text-xs text-gray-400 mb-5">
          {card.institution_name}
          {card.last_four ? ` ·· ${card.last_four}` : ""}
        </p>

        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
          Account name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          autoFocus
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 mb-4"
        />

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full bg-orange-500 text-white font-semibold rounded-xl py-3.5 text-sm disabled:opacity-50 active:bg-orange-600"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}

export default function AccountsClient({ initialCards }: { initialCards: CardDisplay[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [cards, setCards] = useState(initialCards);
  const [editingCard, setEditingCard] = useState<CardDisplay | null>(null);

  function handleNameSaved(cardId: string, newName: string) {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, account_name: newName } : c))
    );
    setEditingCard(null);
    startTransition(() => router.refresh());
  }

  // Group by institution
  const institutions = new Map<string, CardDisplay[]>();
  for (const card of cards) {
    const arr = institutions.get(card.institution_name) ?? [];
    arr.push(card);
    institutions.set(card.institution_name, arr);
  }

  return (
    <>
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
                // Use current balance for all accounts; negate credit so owed shows negative
                const raw = card.balance_current;
                const displayAmount = raw !== null ? (isCredit ? -raw : raw) : null;
                const isNegative = displayAmount !== null && displayAmount < 0;

                return (
                  <div key={card.id} className="flex items-center gap-3 px-4 py-4">
                    {/* Navigate to account detail */}
                    <Link
                      href={`/accounts/${card.id}`}
                      className="flex items-center gap-3 flex-1 min-w-0 active:opacity-70"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                        💳
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {card.account_name}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">
                          {card.account_type}
                          {card.last_four && ` ·· ${card.last_four}`}
                        </p>
                      </div>
                    </Link>

                    {/* Balance */}
                    <div className="text-right mr-1 flex-shrink-0">
                      {displayAmount !== null ? (
                        <>
                          <p
                            className={`font-bold text-base tabular-nums ${
                              isNegative ? "text-red-500" : "text-gray-900"
                            }`}
                          >
                            {isNegative ? "-" : ""}$
                            {Math.abs(displayAmount).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-xs text-gray-400">current balance</p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-300">—</p>
                      )}
                    </div>

                    {/* Edit button */}
                    <button
                      onClick={() => setEditingCard(card)}
                      className="text-gray-300 active:text-orange-500 transition-colors p-1 flex-shrink-0"
                      aria-label="Edit account name"
                    >
                      ✏️
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {editingCard && (
        <EditNameSheet
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSaved={(name) => handleNameSaved(editingCard.id, name)}
        />
      )}
    </>
  );
}
