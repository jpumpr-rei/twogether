-- ============================================================
-- Transaction splits: allows splitting one transaction across
-- multiple categories (e.g. $50 → $30 Groceries + $20 Gas).
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. Create transaction_splits table
CREATE TABLE IF NOT EXISTS public.transaction_splits (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  category_id   uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  amount        numeric NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

-- 3. RLS: couple members can manage splits for their own transactions
DROP POLICY IF EXISTS "couple members can view splits" ON public.transaction_splits;
CREATE POLICY "couple members can view splits" ON public.transaction_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND t.couple_id = public.my_couple_id()
    )
  );

DROP POLICY IF EXISTS "couple members can insert splits" ON public.transaction_splits;
CREATE POLICY "couple members can insert splits" ON public.transaction_splits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND t.couple_id = public.my_couple_id()
    )
  );

DROP POLICY IF EXISTS "couple members can delete splits" ON public.transaction_splits;
CREATE POLICY "couple members can delete splits" ON public.transaction_splits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND t.couple_id = public.my_couple_id()
    )
  );
