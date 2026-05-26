-- Track when a couple's transactions were last synced from Plaid.
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz DEFAULT NULL;
