-- ============================================================
-- twogether — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── couples ───────────────────────────────────────────────
create table public.couples (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at  timestamptz not null default now()
);

alter table public.couples enable row level security;

-- Members of a couple can read/update their couple
create policy "couple members can read" on public.couples
  for select using (
    id in (select couple_id from public.profiles where id = auth.uid())
  );

create policy "couple members can update" on public.couples
  for update using (
    id in (select couple_id from public.profiles where id = auth.uid())
  );

-- ─── profiles ──────────────────────────────────────────────
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

-- Users can read their own profile; couple members can read each other
create policy "users can read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "couple members can read partner profile" on public.profiles
  for select using (
    couple_id is not null and
    couple_id in (select couple_id from public.profiles where id = auth.uid())
  );

create policy "users can update own profile" on public.profiles
  for update using (id = auth.uid());

-- Auto-create profile on signup
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
    couple_id in (select couple_id from public.profiles where id = auth.uid())
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

-- Couple members can see their own categories + global defaults
create policy "couple members can read categories" on public.categories
  for select using (
    is_default = true or
    couple_id in (select couple_id from public.profiles where id = auth.uid())
  );

create policy "couple members can manage categories" on public.categories
  for all using (
    couple_id in (select couple_id from public.profiles where id = auth.uid())
  );

-- Seed default categories
insert into public.categories (name, icon, color, is_default) values
  ('Groceries',     '🛒', '#22c55e', true),
  ('Dining Out',    '🍽️', '#f97316', true),
  ('Transport',     '🚗', '#3b82f6', true),
  ('Entertainment', '🎬', '#a855f7', true),
  ('Shopping',      '🛍️', '#ec4899', true),
  ('Health',        '💊', '#ef4444', true),
  ('Travel',        '✈️', '#0ea5e9', true),
  ('Utilities',     '💡', '#eab308', true),
  ('Rent/Mortgage', '🏠', '#6366f1', true),
  ('Savings',       '💰', '#10b981', true),
  ('Other',         '📦', '#6b7280', true);

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
    couple_id in (select couple_id from public.profiles where id = auth.uid())
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
    couple_id in (select couple_id from public.profiles where id = auth.uid())
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
