-- Track whether a transaction's category was set manually by the user.
-- Sync will never overwrite category_id when this is true.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS category_manually_set boolean DEFAULT false NOT NULL;
