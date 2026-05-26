"use client";

import { useState } from "react";

export function formatLastSynced(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffHr < 48) return "yesterday";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SyncButton({
  lastSyncedAt,
  onSynced,
}: {
  lastSyncedAt: string | null;
  onSynced: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(lastSyncedAt);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/sync-transactions", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSyncedAt(new Date().toISOString());
      onSynced();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const label = formatLastSynced(syncedAt);

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-1.5 text-xs font-medium text-orange-500 disabled:opacity-50 py-1 px-2 rounded-lg hover:bg-orange-50 active:bg-orange-50"
      >
        <span className={syncing ? "animate-spin inline-block" : ""}>↻</span>
        {syncing ? "Syncing…" : "Sync"}
      </button>
      {error
        ? <p className="text-xs text-red-400 pr-2">{error}</p>
        : label && <p className="text-xs text-gray-400 pr-2">{label}</p>
      }
    </div>
  );
}
