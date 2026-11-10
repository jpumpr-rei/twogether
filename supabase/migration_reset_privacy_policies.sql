-- ─── Re-assert the account-privacy row-level security ──────────────────────
-- A hidden (is_private) account is meant to be visible only to the person who linked it
-- (cards.owner_id) — and so are its transactions and their splits. That rule lives in the
-- policies on cards, transactions and transaction_splits.
--
-- Row-level security is additive: ONE extra permissive policy lets everyone in the household
-- see everything, and the privacy policies then do nothing. The old
-- "couple members can manage cards" / "couple members can manage transactions" FOR ALL
-- policies (schema.sql, migration_fix_rls.sql) are exactly that. migration_security_fixes.sql
-- removes them, but only if it has been run, and running migration_fix_rls.sql afterwards
-- brings them back. Likewise migration_plaid.sql replaces the privacy policy on cards with a
-- plain one if it runs after migration_account_privacy.sql.
--
-- This script drops EVERY policy on those three tables and recreates exactly the intended
-- set, so it repairs the database whatever state it is in: leftover policies, missing ones,
-- or row-level security switched off. It is safe to re-run, and it runs as one transaction,
-- so if any statement fails nothing changes. If you ever added a policy of your own to these
-- tables on purpose, re-add it afterwards.
--
-- Run this LAST, and again after any other script that touches policies on these tables.
--
-- To see what is there before and after:
--   select c.relname as table_name, c.relrowsecurity as rls_on, p.policyname, p.cmd,
--          p.permissive, coalesce(p.qual ilike '%is_private%', false) as applies_privacy
--   from pg_class c
--   left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
--   where c.oid in ('public.cards'::regclass, 'public.transactions'::regclass,
--                   'public.transaction_splits'::regclass)
--   order by c.relname, p.cmd, p.policyname;
-- Expected: 11 policies, rls_on true everywhere, and applies_privacy true on the SELECT policy
-- of cards and on the SELECT, UPDATE and DELETE policies of transactions.

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('cards', 'transactions', 'transaction_splits')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$$;

alter table public.cards              enable row level security;
alter table public.transactions       enable row level security;
alter table public.transaction_splits enable row level security;

-- ── cards ─────────────────────────────────────────────────────────────────
-- Visible to the household, except that a private account is visible only to its holder.
-- A private account is still listed for the household (name, balance, "Private" badge); only its
-- transactions are hidden (see below). Only the holder can edit or remove a private account.
create policy "couple members can view their cards" on public.cards
  for select using (couple_id = public.my_couple_id());

create policy "couple members can insert cards" on public.cards
  for insert with check (couple_id = public.my_couple_id());

create policy "couple members can update cards" on public.cards
  for update using (
    couple_id = public.my_couple_id()
    and (not is_private or owner_id = auth.uid())
  );

create policy "couple members can delete cards" on public.cards
  for delete using (
    couple_id = public.my_couple_id()
    and (not is_private or owner_id = auth.uid())
  );

-- ── transactions ──────────────────────────────────────────────────────────
-- The same rule: a transaction on a private account can be seen, edited and deleted only by
-- that account's holder. (Who may change is_private / owner_id is enforced separately by the
-- trigger in migration_account_holder_privacy.sql.)
create policy "couple members can view their transactions" on public.transactions
  for select using (
    couple_id = public.my_couple_id()
    and (
      card_id is null
      or card_id in (
        select id from public.cards
        where couple_id = public.my_couple_id()
          and (not is_private or owner_id = auth.uid())
      )
    )
  );

create policy "couple members can insert transactions" on public.transactions
  for insert with check (couple_id = public.my_couple_id());

create policy "couple members can update transactions" on public.transactions
  for update using (
    couple_id = public.my_couple_id()
    and (
      card_id is null
      or card_id in (
        select id from public.cards
        where couple_id = public.my_couple_id()
          and (not is_private or owner_id = auth.uid())
      )
    )
  );

create policy "couple members can delete transactions" on public.transactions
  for delete using (
    couple_id = public.my_couple_id()
    and (
      card_id is null
      or card_id in (
        select id from public.cards
        where couple_id = public.my_couple_id()
          and (not is_private or owner_id = auth.uid())
      )
    )
  );

-- ── transaction_splits ────────────────────────────────────────────────────
-- A split follows its transaction, so the splits of a private account's transactions are
-- hidden too (the lookup below goes through the transactions policy above).
create policy "couple members can view splits" on public.transaction_splits
  for select using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_splits.transaction_id
        and t.couple_id = public.my_couple_id()
    )
  );

create policy "couple members can insert splits" on public.transaction_splits
  for insert with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_splits.transaction_id
        and t.couple_id = public.my_couple_id()
    )
  );

create policy "couple members can delete splits" on public.transaction_splits
  for delete using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_splits.transaction_id
        and t.couple_id = public.my_couple_id()
    )
  );
