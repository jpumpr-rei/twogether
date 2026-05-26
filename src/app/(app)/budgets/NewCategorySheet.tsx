"use client";

import { useState, useRef, useEffect } from "react";
import { createCategory } from "./actions";

const PRESET_COLORS = [
  "#f97316", // orange
  "#ef4444", // red
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // green
  "#f59e0b", // amber
  "#14b8a6", // teal
  "#6b7280", // gray
];

const PRESET_ICONS = [
  "🛒", "🍔", "🍕", "☕", "🍷", "🥗",
  "🏠", "🚗", "✈️", "🚌", "⛽", "🚲",
  "👗", "👟", "💄", "💇", "💆", "🛍️",
  "💊", "🏥", "🦷", "💪", "🧘", "🏋️",
  "🎬", "🎵", "🎮", "📚", "🎨", "🎁",
  "📱", "💻", "🔧", "🌿", "🐾", "🧒",
  "🎓", "🌐", "💰", "🏦", "🛡️", "📦",
];

export default function NewCategorySheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  async function handleSave() {
    if (!name.trim()) { setError("Please enter a category name."); return; }
    setSaving(true);
    setError(null);
    try {
      await createCategory(name.trim(), icon, color);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSaving(false);
    }
  }

  const iconBg = color ? color + "22" : "#f3f4f6";
  const previewIcon = icon ?? "📦";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl z-[70] px-6 pt-4 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        {/* Preview */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: iconBg }}
          >
            {previewIcon}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">
              {name.trim() || <span className="text-gray-300">Category name</span>}
            </p>
            <p className="text-sm text-gray-400">New category</p>
          </div>
        </div>

        {/* Name */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Name
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="e.g. Groceries"
            maxLength={50}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* Icon grid */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Icon
          </label>
          <div className="grid grid-cols-6 gap-2">
            {PRESET_ICONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setIcon(icon === emoji ? null : emoji)}
                className={`w-full aspect-square rounded-xl text-2xl flex items-center justify-center transition-colors ${
                  icon === emoji
                    ? "bg-orange-100 ring-2 ring-orange-400"
                    : "bg-gray-50 hover:bg-gray-100 active:bg-gray-200"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Color swatches */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Color
          </label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(color === c ? null : c)}
                className="w-8 h-8 rounded-full transition-transform hover:scale-110 active:scale-95 flex items-center justify-center"
                style={{ backgroundColor: c }}
                aria-label={c}
              >
                {color === c && (
                  <span className="text-white text-sm font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full bg-orange-500 text-white font-semibold rounded-xl py-3.5 text-base disabled:opacity-50 hover:bg-orange-600 active:bg-orange-600 mb-2"
        >
          {saving ? "Creating…" : "Create category"}
        </button>
      </div>
    </>
  );
}
