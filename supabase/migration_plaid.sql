-- ============================================================
-- Plaid integration: add access token to cards, unique
-- constraints for upserts, and RLS policies for cards.
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. Add plaid_access_token column to cards
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS plaid_access_token TEXT;

-- 2. Unique constraint on plaid_account_id (for upsert)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cards_plaid_account_id_key'
  ) THEN
    ALTER TABLE public.cards ADD CONSTRAINT cards_plaid_account_id_key UNIQUE (plaid_account_id);
  END IF;
END $$;

-- 3. Unique constraint on plaid_transaction_id (for upsert)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_plaid_transaction_id_key'
  ) THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_plaid_transaction_id_key UNIQUE (plaid_transaction_id);
  END IF;
END $$;

-- 4. Enable RLS on cards
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for cards
DROP POLICY IF EXISTS "couple members can view their cards" ON public.cards;
CREATE POLICY "couple members can view their cards" ON public.cards
  FOR SELECT USING (couple_id = public.my_couple_id());

DROP POLICY IF EXISTS "couple members can insert cards" ON public.cards;
CREATE POLICY "couple members can insert cards" ON public.cards
  FOR INSERT WITH CHECK (couple_id = public.my_couple_id());

DROP POLICY IF EXISTS "couple members can update their cards" ON public.cards;
CREATE POLICY "couple members can update their cards" ON public.cards
  FOR UPDATE USING (couple_id = public.my_couple_id());

-- NOTE: Also add your OAuth redirect URI in Plaid Dashboard under
-- Team Settings > API > Allowed redirect URIs:
--   http://localhost:3000/plaid-oauth    (local dev)
--   https://yourdomain.com/plaid-oauth  (production)
