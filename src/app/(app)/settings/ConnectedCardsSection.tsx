"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeCard } from "./actions";
import PlaidConnectButton from "@/components/ui/PlaidConnectButton";

type CardRow = {
  id: string;
  institution_name: string;
  account_name: string;
  last_four: string | null;
  account_type: string;
};

export default function ConnectedCardsSection({ cards }: { cards: CardRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleRemove(cardId: string) {
    setRemoving(cardId);
    await removeCard(cardId);
    setConfirmingId(null);
    setRemoving(null);
    startTransition(() => router.refresh());
  }

  if (cards.length === 0) {
    return (
      <div className="px-4 py-4 text-sm text-gray-500 space-y-3">
        <p>No accounts connected yet. Link your bank to start tracking spending.</p>
        <PlaidConnectButton />
      </div>
    );
  }

  return (
    <>
      {cards.map((card) => (
        <div key={card.id} className="px-4 py-3">
          {confirmingId === card.id ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">Remove {card.account_name}?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmingId(null)}
                  className="text-sm text-gray-400 font-medium active:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRemove(card.id)}
                  disabled={removing === card.id}
                  className="text-sm text-red-500 font-semibold active:opacity-60 disabled:opacity-40"
                >
                  {removing === card.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-base flex-shrink-0">
                🏦
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">
                  {card.institution_name}
                </p>
                <p className="text-xs text-gray-400 capitalize">
                  {card.account_name}
                  {card.last_four && <span className="ml-1">·· {card.last_four}</span>}
                </p>
              </div>
              <button
                onClick={() => setConfirmingId(card.id)}
                className="text-xs text-red-400 font-medium active:opacity-60 flex-shrink-0"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ))}
      <div className="px-4 py-3 border-t border-gray-50">
        <PlaidConnectButton />
      </div>
    </>
  );
}
