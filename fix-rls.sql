-- Run this script in the Supabase SQL Editor to fix the RLS Infinite Recursion Bug!

-- 1. Drop the bad recursive policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- 2. Create a secure function that bypasses RLS to check for the admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER -- This makes it run with admin database privileges, bypassing RLS!
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Check the role of the currently authenticated user
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid() LIMIT 1;
  RETURN user_role = 'admin';
END;
$$;

-- 3. Re-create the policies using the new safe function!
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING ( public.is_admin() );

CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING ( public.is_admin() );
