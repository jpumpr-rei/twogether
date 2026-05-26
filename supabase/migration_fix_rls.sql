-- ============================================================
-- Fix infinite recursion (42P17) in RLS policies.
--
-- The "couple members can read partner profile" policy on
-- public.profiles queries public.profiles from within itself,
-- causing infinite recursion whenever Postgres evaluates it.
--
-- Fix: a SECURITY DEFINER function that reads the current user's
-- couple_id without triggering RLS, used everywhere instead of
-- the inline subquery.
-- ============================================================

-- 1. Create the helper function (runs as superuser, bypasses RLS)
create or replace function public.my_couple_id()
returns uuid language sql security definer stable
set search_path = public as $$
  select couple_id from public.profiles where id = auth.uid()
$$;

-- 1b. Allow any authenticated user to INSERT a couple
--     (no INSERT policy existed — all couple creation was silently blocked)
drop policy if exists "authenticated users can create couples" on public.couples;
create policy "authenticated users can create couples" on public.couples
  for insert with check (auth.uid() is not null);

-- 2. Drop all policies that referenced the old inline subquery
drop policy if exists "couple members can read partner profile" on public.profiles;
drop policy if exists "couple members can read"                 on public.couples;
drop policy if exists "couple members can update"               on public.couples;
drop policy if exists "couple members can manage cards"         on public.cards;
drop policy if exists "couple members can read categories"      on public.categories;
drop policy if exists "couple members can manage categories"    on public.categories;
drop policy if exists "couple members can manage transactions"  on public.transactions;
drop policy if exists "couple members can manage budgets"       on public.budgets;

-- 3. Recreate policies using the helper function
create policy "couple members can read partner profile" on public.profiles
  for select using (
    couple_id is not null and couple_id = public.my_couple_id()
  );

create policy "couple members can read" on public.couples
  for select using (id = public.my_couple_id());

create policy "couple members can update" on public.couples
  for update using (id = public.my_couple_id());

create policy "couple members can manage cards" on public.cards
  for all using (couple_id = public.my_couple_id());

create policy "couple members can read categories" on public.categories
  for select using (
    is_default = true or couple_id = public.my_couple_id()
  );

create policy "couple members can manage categories" on public.categories
  for all using (couple_id = public.my_couple_id());

create policy "couple members can manage transactions" on public.transactions
  for all using (couple_id = public.my_couple_id());

create policy "couple members can manage budgets" on public.budgets
  for all using (couple_id = public.my_couple_id());
