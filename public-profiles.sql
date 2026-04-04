-- Run this script in the Supabase SQL Editor to allow everyone to view profiles on the leaderboard.
-- We will change the profile SELECT policy so that anyone authenticated can read basic profile info.

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create a new policy that allows anyone to view profiles (needed for the leaderboard)
CREATE POLICY "Anyone can view profiles" 
ON public.profiles FOR SELECT 
USING ( true );
