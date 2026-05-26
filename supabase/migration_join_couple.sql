-- Function to join a couple by invite code.
-- SECURITY DEFINER lets it bypass RLS to migrate data atomically.
CREATE OR REPLACE FUNCTION public.join_couple_by_code(p_invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_couple_id UUID;
  v_current_couple_id UUID;
  v_member_count INT;
  v_user_id UUID := auth.uid();
BEGIN
  -- Find couple by invite code (case-insensitive)
  SELECT id INTO v_target_couple_id
  FROM public.couples
  WHERE UPPER(invite_code) = UPPER(TRIM(p_invite_code));

  IF v_target_couple_id IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_code');
  END IF;

  -- Get current user's couple
  SELECT couple_id INTO v_current_couple_id
  FROM public.profiles
  WHERE id = v_user_id;

  -- Can't join your own couple
  IF v_current_couple_id = v_target_couple_id THEN
    RETURN jsonb_build_object('error', 'own_couple');
  END IF;

  -- Check if target couple is already full (2 members)
  SELECT COUNT(*) INTO v_member_count
  FROM public.profiles
  WHERE couple_id = v_target_couple_id;

  IF v_member_count >= 2 THEN
    RETURN jsonb_build_object('error', 'couple_full');
  END IF;

  -- Migrate this user's cards to the target couple
  IF v_current_couple_id IS NOT NULL THEN
    UPDATE public.cards
    SET couple_id = v_target_couple_id
    WHERE owner_id = v_user_id
      AND couple_id = v_current_couple_id;

    -- Migrate transactions on those cards
    UPDATE public.transactions
    SET couple_id = v_target_couple_id
    WHERE couple_id = v_current_couple_id
      AND card_id IN (
        SELECT id FROM public.cards WHERE owner_id = v_user_id
      );
  END IF;

  -- Move user to the new couple
  UPDATE public.profiles
  SET couple_id = v_target_couple_id
  WHERE id = v_user_id;

  -- Delete old couple if it is now empty
  IF v_current_couple_id IS NOT NULL THEN
    DELETE FROM public.couples
    WHERE id = v_current_couple_id
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE couple_id = v_current_couple_id
      );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
