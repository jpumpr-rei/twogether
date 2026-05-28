-- Add is_transfer flag to transactions.
-- Set to true for credit card payments and other loan payments identified
-- by Plaid's personal_finance_category.primary = 'LOAN_PAYMENTS'.
-- The sync code populates this going forward; existing rows default to false
-- and will be corrected on the next sync run.
--
-- Run this in the Supabase SQL editor.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_transfer boolean NOT NULL DEFAULT false;
