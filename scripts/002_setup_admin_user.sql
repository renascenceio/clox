-- This script should be run AFTER the admin user (aslan@renascence.io) signs up
-- It will grant super admin privileges to that user

-- First, find the user ID for aslan@renascence.io
-- Then insert them into admin_users table

-- You can run this in the Supabase SQL Editor:

-- Step 1: Insert admin user (replace USER_ID with actual UUID from auth.users)
-- INSERT INTO public.admin_users (id, email, is_super_admin)
-- SELECT id, email, TRUE
-- FROM auth.users
-- WHERE email = 'aslan@renascence.io';

-- OR use this one-liner:
DO $$
BEGIN
  INSERT INTO public.admin_users (id, email, is_super_admin)
  SELECT id, email, TRUE
  FROM auth.users
  WHERE email = 'aslan@renascence.io'
  ON CONFLICT (id) DO UPDATE SET is_super_admin = TRUE;
END $$;
