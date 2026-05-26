"use client";

import { useState, useTransition } from "react";
import { updateDisplayName } from "./profileActions";

export default function EditNameRow({
  initialName,
}: {
  initialName: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [displayedName, setDisplayedName] = useState(initialName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleEdit() {
    setName(displayedName);
    setError(null);
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    const res = await updateDisplayName(name);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDisplayedName(name.trim());
    setEditing(false);
    startTransition(() => {}); // triggers rerender with fresh server data
  }

  if (editing) {
    return (
      <div className="px-4 py-3 space-y-2">
        <label className="text-sm text-gray-500">Name</label>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={50}
            placeholder="Your name"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
          />
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="text-sm font-semibold text-orange-500 px-2 py-1 active:opacity-60 disabled:opacity-30"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="text-sm text-gray-400 px-2 py-1 active:opacity-60"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-500">Name</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-900">
          {displayedName || <span className="text-gray-400">—</span>}
        </span>
        <button
          onClick={handleEdit}
          className="text-xs font-semibold text-orange-500 active:opacity-60"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
