-- Add is_private flag to cards
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

-- Update cards SELECT policy: joint accounts visible to all couple members,
-- private accounts only visible to the owner
DROP POLICY IF EXISTS "couple members can view their cards" ON public.cards;
CREATE POLICY "couple members can view their cards" ON public.cards
  FOR SELECT USING (
    couple_id = public.my_couple_id()
    AND (NOT is_private OR owner_id = auth.uid())
  );

-- Update transactions SELECT policy: hide transactions that belong to private
-- cards the current user doesn't own
DROP POLICY IF EXISTS "couple members can view their transactions" ON public.transactions;
CREATE POLICY "couple members can view their transactions" ON public.transactions
  FOR SELECT USING (
    couple_id = public.my_couple_id()
    AND (
      card_id IS NULL
      OR card_id IN (
        SELECT id FROM public.cards
        WHERE couple_id = public.my_couple_id()
          AND (NOT is_private OR owner_id = auth.uid())
      )
    )
  );
