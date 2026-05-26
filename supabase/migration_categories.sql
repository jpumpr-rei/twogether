-- ============================================================
-- Run this in Supabase SQL Editor to replace default categories
-- and seed budgets directly for all existing couples.
-- ============================================================

-- 1. Remove old default categories
--    (ON DELETE SET NULL clears category_id on any existing budgets)
DELETE FROM public.categories WHERE is_default = true;

-- 2. Insert updated categories
INSERT INTO public.categories (name, icon, color, is_default) VALUES
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

-- 3. Delete old/orphaned budgets (category_id = NULL after step 1 cascade)
DELETE FROM public.budgets WHERE category_id IS NULL;

-- 4. Seed default monthly budgets for every existing couple that has none
DO $$
DECLARE
  couple_uuid uuid;
BEGIN
  FOR couple_uuid IN SELECT id FROM public.couples LOOP
    IF NOT EXISTS (SELECT 1 FROM public.budgets WHERE couple_id = couple_uuid LIMIT 1) THEN
      INSERT INTO public.budgets (couple_id, category_id, name, amount, period)
      SELECT
        couple_uuid,
        c.id,
        c.name,
        CASE c.name
          WHEN 'Groceries'             THEN 600
          WHEN 'Food & Drink'          THEN 400
          WHEN 'Utilities & Insurance' THEN 300
          WHEN 'Travel'                THEN 200
          WHEN 'Gas'                   THEN 150
          WHEN 'Entertainment'         THEN 100
          WHEN 'Health & Beauty'       THEN 100
          WHEN 'Household Supplies'    THEN 100
          WHEN 'Subscriptions'         THEN 75
          WHEN 'Individual Allowance'  THEN 200
          WHEN 'Rideshare'             THEN 100
          WHEN 'Gifts & Charity'       THEN 100
          WHEN 'Parking & Transit'     THEN 50
          WHEN 'Car Maintenance'       THEN 100
          WHEN 'Investments'           THEN 500
          WHEN 'Home Improvement'      THEN 200
          WHEN 'Miscellaneous'         THEN 100
        END,
        'monthly'
      FROM public.categories c
      WHERE c.is_default = true
        AND c.name IN (
          'Groceries', 'Food & Drink', 'Utilities & Insurance', 'Travel', 'Gas',
          'Entertainment', 'Health & Beauty', 'Household Supplies', 'Subscriptions',
          'Individual Allowance', 'Rideshare', 'Gifts & Charity', 'Parking & Transit',
          'Car Maintenance', 'Investments', 'Home Improvement', 'Miscellaneous'
        );
    END IF;
  END LOOP;
END $$;
