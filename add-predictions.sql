-- Run this script in your Supabase SQL Editor.

CREATE TABLE predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  predicted_team TEXT NOT NULL,
  expected_payout NUMERIC NOT NULL DEFAULT 0,
  wager_amount NUMERIC NOT NULL CHECK (wager_amount > 0),
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'won', 'lost')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: We store 'expected_payout' at the time of betting to lock in the odds, or we can just derive it. 
-- For simplicity, since the odds might not change dynamically in this basic version, we can just use the odds from the matches table, but storing it is safer. We'll add it for safety.

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Anyone can view predictions (open leaderboard)
CREATE POLICY "Anyone can view predictions" 
ON predictions FOR SELECT 
USING ( true );

-- Users can insert their own predictions
CREATE POLICY "Users can insert predictions" 
ON predictions FOR INSERT 
WITH CHECK ( auth.uid() = user_id );

-- Admins can manage everything
CREATE POLICY "Admins can manage predictions" 
ON predictions FOR ALL 
USING ( public.is_admin() );

-- Optional: Allow users to update their predictions if needed? 
-- Let's not allow updates for now to keep the code simpler.

