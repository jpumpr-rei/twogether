-- ─── Only the account holder can hide an account ───────────────────────────
-- The "account holder" is cards.owner_id: the person who linked the bank.
--
-- Visibility was already tied to the holder — migration_account_privacy.sql lets only
-- cards.owner_id see a private card and its transactions. What was missing is a rule
-- about who may CHANGE that. The cards UPDATE policy only checks couple membership, so
-- any household member could set owner_id to themselves on a joint account — making
-- themselves its holder — and, in the same statement or the next, mark it private,
-- hiding it from the person who actually linked it.
-- (Flipping is_private alone is already refused to a non-holder today, but only as a
-- side effect of row-level security: the updated row would no longer be visible to them.
-- That is not a stated rule, so the trigger below makes it explicit.)
--
-- This trigger enforces it in the database, so it holds for the app's server action
-- and for anyone calling the API directly with their own session:
--   • is_private can only be changed by the account holder
--   • owner_id can only be changed by the account holder (it decides who sees a private
--     account, so changing it is the same privilege)
--
-- Everything else on the row is untouched: either partner can still rename a joint
-- account, and syncing keeps working. Requests with no signed-in user — the service-role
-- key used by the cron sync, the SQL editor — have auth.uid() = NULL and are not
-- restricted, so admin and maintenance work keeps working.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.enforce_account_holder_privacy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM OLD.owner_id
     AND (
       NEW.is_private IS DISTINCT FROM OLD.is_private
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     )
  THEN
    RAISE EXCEPTION 'only_account_holder_can_change_privacy'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_account_holder_privacy ON public.cards;
CREATE TRIGGER enforce_account_holder_privacy
  BEFORE UPDATE OF is_private, owner_id ON public.cards
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_account_holder_privacy();


-- ── To confirm the live database matches the migrations in this repo ─────────
-- A hidden account is visible only to its holder if, and only if, these tables have
-- no permissive policy beyond the ones the migrations create. Run this in the SQL
-- editor and check that no "FOR ALL" / extra SELECT policy appears:
--
--   select tablename, policyname, cmd, qual
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('cards', 'transactions', 'transaction_splits')
--   order by tablename, cmd, policyname;
--
-- Expected SELECT policies: "couple members can view their cards",
-- "couple members can view their transactions", "couple members can view splits".
