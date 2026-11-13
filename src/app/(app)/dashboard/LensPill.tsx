"use client";

import { LENSES, type Lens } from "@/lib/home/types";

const LABELS: Record<Lens, string> = { ours: "Ours", mine: "Mine", theirs: "Theirs" };

/** Ours / Mine / Theirs: whose money the screen is showing. */
export default function LensPill({
  lens,
  onChange,
}: {
  lens: Lens;
  onChange: (lens: Lens) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Whose money"
      className="flex gap-0.5 rounded-full border-2 border-line bg-card p-[3px]"
    >
      {LENSES.map((l) => {
        const selected = l === lens;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(l)}
            className={`flex-1 rounded-full py-2.5 text-[15px] font-medium transition-colors duration-200 ${
              selected ? "bg-white text-ink" : "text-white"
            }`}
          >
            {LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
