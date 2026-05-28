-- Remove "Credit Card Payments" category.
-- Credit card payments are implicit in the individual budget categories
-- and don't need a separate tracking category.
--
-- Effects:
--   • Budgets linked to this category are deleted (no orphaned rows)
--   • Transactions previously in this category become uncategorized
--     (FK is ON DELETE SET NULL — no transactions are lost)
--
-- Run this in the Supabase SQL editor.

DELETE FROM public.budgets
WHERE category_id IN (
  SELECT id FROM public.categories
  WHERE LOWER(name) = 'credit card payments'
);

DELETE FROM public.categories
WHERE LOWER(name) = 'credit card payments';
