-- ============================================================
-- twogether — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── couples ───────────────────────────────────────────────
create table public.couples (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at  timestamptz not null default now()
);

alter table public.couples enable row level security;

-- ─── profiles ──────────────────────────────────────────────
-- Created before couples policies so the cross-table references work.
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  email        text not null,
  display_name text,
  avatar_url   text,
  couple_id    uuid references public.couples(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper: returns the current user's couple_id without triggering RLS
-- (SECURITY DEFINER bypasses RLS on the profiles lookup, preventing
--  infinite recursion when policies on other tables check this value)
create or replace function public.my_couple_id()
returns uuid language sql security definer stable
set search_path = public as $$
  select couple_id from public.profiles where id = auth.uid()
$$;

-- ─── couples policies (after profiles exists) ──────────────
create policy "couple members can read" on public.couples
  for select using (id = public.my_couple_id());

create policy "couple members can update" on public.couples
  for update using (id = public.my_couple_id());

-- ─── profiles policies ─────────────────────────────────────
create policy "users can read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "couple members can read partner profile" on public.profiles
  for select using (
    couple_id is not null and couple_id = public.my_couple_id()
  );

create policy "users can update own profile" on public.profiles
  for update using (id = auth.uid());

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── cards ─────────────────────────────────────────────────
create table public.cards (
  id               uuid primary key default gen_random_uuid(),
  couple_id        uuid not null references public.couples(id) on delete cascade,
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  plaid_item_id    text,
  plaid_account_id text,
  institution_name text not null,
  account_name     text not null,
  last_four        text,
  account_type     text not null default 'depository',
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table public.cards enable row level security;

create policy "couple members can manage cards" on public.cards
  for all using (
    couple_id = public.my_couple_id()
  );

-- ─── categories ────────────────────────────────────────────
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid references public.couples(id) on delete cascade,
  name       text not null,
  icon       text,
  color      text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "couple members can read categories" on public.categories
  for select using (
    is_default = true or couple_id = public.my_couple_id()
  );

create policy "couple members can manage categories" on public.categories
  for all using (
    couple_id = public.my_couple_id()
  );

insert into public.categories (name, icon, color, is_default) values
  ('Groceries',             '🛒', '#16a34a', true),
  ('Food & Drink',          '🍽️', '#3b82f6', true),
  ('Utilities & Insurance', '🏠', '#f97316', true),
  ('Travel',                '✈️', '#0ea5e9', true),
  ('Gas',                   '⛽', '#dc2626', true),
  ('Entertainment',         '🎬', '#f59e0b', true),
  ('Health & Beauty',       '💊', '#a855f7', true),
  ('Household Supplies',    '🛍️', '#eab308', true),
  ('Subscriptions',         '📱', '#475569', true),
  ('Individual Allowance',  '👤', '#a3a3a3', true),
  ('Rideshare',             '🚕', '#8b5cf6', true),
  ('Gifts & Charity',       '🎁', '#06b6d4', true),
  ('Parking & Transit',     '🚌', '#6366f1', true),
  ('Car Maintenance',       '🔧', '#78716c', true),
  ('Investments',           '📈', '#10b981', true),
  ('Home Improvement',      '🔨', '#b45309', true),
  ('Miscellaneous',         '💲', '#ef4444', true),
  ('Real Estate',           '🔑', '#14b8a6', true),
  ('Reimbursed',            '💵', '#22c55e', true);

-- ─── transactions ──────────────────────────────────────────
create table public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  couple_id            uuid not null references public.couples(id) on delete cascade,
  card_id              uuid references public.cards(id) on delete set null,
  category_id          uuid references public.categories(id) on delete set null,
  plaid_transaction_id text unique,
  merchant_name        text,
  amount               numeric(12, 2) not null,
  currency             text not null default 'USD',
  date                 date not null,
  note                 text,
  is_pending           boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "couple members can manage transactions" on public.transactions
  for all using (
    couple_id = public.my_couple_id()
  );

create index transactions_couple_date_idx on public.transactions (couple_id, date desc);

-- ─── budgets ───────────────────────────────────────────────
create table public.budgets (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name        text not null,
  amount      numeric(12, 2) not null,
  period      text not null check (period in ('weekly', 'monthly', 'yearly')),
  start_date  date not null default current_date,
  end_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.budgets enable row level security;

create policy "couple members can manage budgets" on public.budgets
  for all using (
    couple_id = public.my_couple_id()
  );

-- ─── updated_at triggers ───────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_transactions_updated_at before update on public.transactions
  for each row execute procedure public.set_updated_at();

create trigger set_budgets_updated_at before update on public.budgets
  for each row execute procedure public.set_updated_at();
