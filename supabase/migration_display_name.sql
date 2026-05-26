-- Fix the profile creation trigger to capture display_name from signup metadata.
-- Also backfills existing users who signed up before this fix.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    NULLIF(TRIM(new.raw_user_meta_data->>'display_name'), '')
  );
  RETURN new;
END;
$$;

-- Backfill display_name for any existing users where it's currently null
-- but was stored in auth.users metadata at signup.
UPDATE public.profiles p
SET display_name = NULLIF(TRIM(u.raw_user_meta_data->>'display_name'), '')
FROM auth.users u
WHERE p.id = u.id
  AND p.display_name IS NULL
  AND u.raw_user_meta_data->>'display_name' IS NOT NULL
  AND TRIM(u.raw_user_meta_data->>'display_name') <> '';
