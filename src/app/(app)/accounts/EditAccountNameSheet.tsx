"use client";

import { useState } from "react";
import { updateAccountSettings } from "./actions";

export type EditableCard = {
  id: string;
  institution_name: string;
  account_name: string;
  last_four: string | null;
  is_private: boolean;
};

export default function EditAccountNameSheet({
  card,
  onClose,
  onSaved,
}: {
  card: EditableCard;
  onClose: () => void;
  onSaved: (newName: string, isPrivate: boolean) => void;
}) {
  const [name, setName] = useState(card.account_name);
  const [isPrivate, setIsPrivate] = useState(card.is_private);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateAccountSettings(card.id, { name, isPrivate });
      onSaved(name.trim(), isPrivate);
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
        <p className="font-bold text-gray-900 text-base mb-1">Edit account</p>
        <p className="text-xs text-gray-400 mb-5">
          {card.institution_name}
          {card.last_four ? ` ·· ${card.last_four}` : ""}
        </p>

        {/* Name */}
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
          Account name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          autoFocus
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 mb-5"
        />

        {/* Joint / Private toggle */}
        <button
          onClick={() => setIsPrivate((v) => !v)}
          className="w-full flex items-center gap-3 py-3 mb-5 hover:opacity-90 active:opacity-80"
        >
          {/* Toggle pill */}
          <div
            className={`w-12 h-7 rounded-full flex items-center px-0.5 flex-shrink-0 transition-colors duration-200 ${
              !isPrivate ? "bg-orange-500" : "bg-gray-200"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
                !isPrivate ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-gray-900">
              {isPrivate ? "Private account" : "Joint account"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isPrivate
                ? "Only visible to you — hidden from your partner"
                : "Visible to both partners"}
            </p>
          </div>
          {/* Badge */}
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
              isPrivate
                ? "bg-gray-100 text-gray-500"
                : "bg-orange-50 text-orange-600"
            }`}
          >
            {isPrivate ? "Private" : "Joint"}
          </span>
        </button>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full bg-orange-500 text-white font-semibold rounded-xl py-3.5 text-sm disabled:opacity-50 hover:bg-orange-600 active:bg-orange-600"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}
