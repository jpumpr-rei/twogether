/** The lens: whose money the screen is showing. */
export type Lens = "ours" | "mine" | "theirs";

export const LENSES: readonly Lens[] = ["ours", "mine", "theirs"];

export function parseLens(value: string | undefined | null): Lens {
  return value === "mine" || value === "theirs" ? value : "ours";
}

export const LENS_COOKIE = "tw_lens";

// Row shapes the Home screen is built from (see dashboard/page.tsx).

export type TxPoint = {
  amount: number;
  date: string;
  category_id: string | null;
  card_id: string | null;
};

export type CategoryInfo = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type RecentTx = {
  id: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  category_id: string | null;
  card_id: string | null;
};
