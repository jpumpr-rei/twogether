export type CategoryRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type BudgetRow = {
  id: string;
  name: string;
  amount: number;
  period: string;
  category_id: string | null;
};

// One row per category — budget is null if no amount has been set yet
export type BudgetSlot = {
  category: CategoryRow;
  budget: BudgetRow | null;
  spent: number;
};
