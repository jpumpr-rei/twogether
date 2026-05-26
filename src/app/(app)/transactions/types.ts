export type CategoryInfo = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type SplitRow = {
  id: string;
  category_id: string | null;
  amount: number;
  category: CategoryInfo | null;
};

export type TxRow = {
  id: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  is_pending: boolean;
  category_id: string | null;
  category: CategoryInfo | null;
  card: { institution_name: string; last_four: string | null } | null;
  splits: SplitRow[];
};
