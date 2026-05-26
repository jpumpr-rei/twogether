-- Allow couple members to create custom (non-default) categories.
-- Custom categories are tied to the couple via couple_id.

-- INSERT: couple members can add custom categories for their household
CREATE POLICY "Couple members can insert custom categories"
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    couple_id IS NOT NULL
    AND couple_id IN (
      SELECT couple_id FROM profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: couple members can update their own custom categories
CREATE POLICY "Couple members can update custom categories"
  ON categories
  FOR UPDATE
  TO authenticated
  USING (
    couple_id IS NOT NULL
    AND couple_id IN (
      SELECT couple_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    couple_id IS NOT NULL
    AND couple_id IN (
      SELECT couple_id FROM profiles WHERE id = auth.uid()
    )
  );

-- DELETE: couple members can delete their own custom categories
CREATE POLICY "Couple members can delete custom categories"
  ON categories
  FOR DELETE
  TO authenticated
  USING (
    couple_id IS NOT NULL
    AND couple_id IN (
      SELECT couple_id FROM profiles WHERE id = auth.uid()
    )
  );
