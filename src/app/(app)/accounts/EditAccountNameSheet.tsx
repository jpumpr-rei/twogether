"use client";

import { useState } from "react";
import { updateAccountName } from "./actions";

export type EditableCard = {
  id: string;
  institution_name: string;
  account_name: string;
  last_four: string | null;
};

export default function EditAccountNameSheet({
  card,
  onClose,
  onSaved,
}: {
  card: EditableCard;
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
