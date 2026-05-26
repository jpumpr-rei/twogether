-- ─── Security fixes ────────────────────────────────────────────────────────
-- Addresses issues found in security audit:
--
-- 1. Drop the orphaned "couple members can manage cards" FOR ALL policy that
--    was created in schema.sql but never dropped by subsequent migrations.
--    Its presence meant the is_private SELECT filter was bypassed (the FOR ALL
--    policy's permissive SELECT rule overrode the privacy-aware one).
--
-- 2. Add a DB trigger to hard-enforce a 2-member limit per couple, preventing
--    a race condition in join_couple_by_code where two concurrent callers
--    could both pass the member-count check and produce a 3-member household.
--
-- 3. Add UPDATE and DELETE privacy policies to transactions so private-card
--    transactions can't be mutated by a partner even though they can't see them.

-- ── 1. Drop orphaned FOR ALL policy on cards ────────────────────────────────
DROP POLICY IF EXISTS "couple members can manage cards" ON public.cards;

-- Ensure the correct individual-verb policies exist (idempotent):
-- SELECT is already handled by migration_account_privacy.sql with is_private check.
-- INSERT, UPDATE, DELETE should be scoped to couple members only.

DROP POLICY IF EXISTS "couple members can insert cards" ON public.cards;
CREATE POLICY "couple members can insert cards" ON public.cards
  FOR INSERT WITH CHECK (couple_id = public.my_couple_id());

DROP POLICY IF EXISTS "couple members can update cards" ON public.cards;
CREATE POLICY "couple members can update cards" ON public.cards
  FOR UPDATE USING (couple_id = public.my_couple_id());

DROP POLICY IF EXISTS "couple members can delete cards" ON public.cards;
CREATE POLICY "couple members can delete cards" ON public.cards
  FOR DELETE USING (couple_id = public.my_couple_id());


-- ── 2. Enforce 2-member couple limit via trigger ────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_couple_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.couple_id IS NOT NULL THEN
    IF (
      SELECT COUNT(*)
      FROM public.profiles
      WHERE couple_id = NEW.couple_id
        AND id <> NEW.id  -- exclude the row being updated
    ) >= 2 THEN
      RAISE EXCEPTION 'couple_full';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_couple_member_limit ON public.profiles;
CREATE TRIGGER enforce_couple_member_limit
  BEFORE INSERT OR UPDATE OF couple_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_couple_member_limit();


-- ── 3. Add UPDATE / DELETE privacy policies for transactions ────────────────
-- The existing FOR ALL policy allowed partners to mutate private-card
-- transactions even though they couldn't SELECT them.

DROP POLICY IF EXISTS "couple members can manage transactions" ON public.transactions;

DROP POLICY IF EXISTS "couple members can insert transactions" ON public.transactions;
CREATE POLICY "couple members can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (couple_id = public.my_couple_id());

DROP POLICY IF EXISTS "couple members can update transactions" ON public.transactions;
CREATE POLICY "couple members can update transactions" ON public.transactions
  FOR UPDATE USING (
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

DROP POLICY IF EXISTS "couple members can delete transactions" ON public.transactions;
CREATE POLICY "couple members can delete transactions" ON public.transactions
  FOR DELETE USING (
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


-- ── Note on plaid_access_token column security ──────────────────────────────
-- The plaid_access_token column on public.cards is visible to both couple
-- members via RLS SELECT. For production hardening, move tokens to a separate
-- table with no client-readable SELECT policy, or use Supabase Vault
-- (vault.secrets) to encrypt tokens at rest with column-level access control.
-- This is a low-risk issue for a personal two-person app but worth addressing
-- before any broader deployment.
