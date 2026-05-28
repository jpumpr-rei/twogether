"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory } from "./actions";

export type CategoryRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export default function CategoriesSection({
  categories,
}: {
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function handleDelete(catId: string) {
    setDeletingId(catId);
    setErrorId(null);
    try {
      await deleteCategory(catId);
      setConfirmingId(null);
      startTransition(() => router.refresh());
    } catch {
      setErrorId(catId);
    } finally {
      setDeletingId(null);
    }
  }

  if (categories.length === 0) {
    return (
      <div className="px-4 py-4 text-sm text-gray-400">
        No custom categories yet.
      </div>
    );
  }

  return (
    <>
      {categories.map((cat) => {
        const iconBg = cat.color ? cat.color + "22" : "#f3f4f6";
        const isConfirming = confirmingId === cat.id;
        const isDeleting = deletingId === cat.id;

        return (
          <div key={cat.id} className="px-4 py-3">
            {isConfirming ? (
              <div>
                <p className="text-sm text-gray-800 font-medium mb-0.5">
                  Delete &ldquo;{cat.name}&rdquo;?
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Transactions in this category will become uncategorized.
                  Any budget set for it will also be removed.
                </p>
                {errorId === cat.id && (
                  <p className="text-xs text-red-500 mb-2">
                    Something went wrong — please try again.
                  </p>
                )}
                <div className="flex gap-4">
                  <button
                    onClick={() => { setConfirmingId(null); setErrorId(null); }}
                    className="text-sm text-gray-400 font-medium active:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    disabled={isDeleting}
                    className="text-sm text-red-500 font-semibold active:opacity-60 disabled:opacity-40"
                  >
                    {isDeleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                  style={{ backgroundColor: iconBg }}
                >
                  {cat.icon ?? "📦"}
                </div>
                <p className="flex-1 text-sm font-medium text-gray-900 truncate">
                  {cat.name}
                </p>
                <button
                  onClick={() => setConfirmingId(cat.id)}
                  className="text-xs text-red-400 font-medium active:opacity-60 flex-shrink-0"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
