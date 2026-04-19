-- Run this in your Supabase SQL Editor to implement the AMM Odds Movement

-- 1. Add necessary columns to track wagers and initial state
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS initial_a_odds_percent NUMERIC,
ADD COLUMN IF NOT EXISTS initial_b_odds_percent NUMERIC,
ADD COLUMN IF NOT EXISTS total_wager_a NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_wager_b NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS liquidity NUMERIC DEFAULT 1000;

-- 2. Backfill initial state from existing odds
UPDATE public.matches 
SET 
  initial_a_odds_percent = team_a_odds_percent,
  initial_b_odds_percent = team_b_odds_percent
WHERE initial_a_odds_percent IS NULL;

-- 3. Backfill total wagers from existing predictions
UPDATE public.matches m
SET 
  total_wager_a = COALESCE((SELECT SUM(wager_amount) FROM public.predictions p WHERE p.match_id = m.id AND p.predicted_team = 'team_a'), 0),
  total_wager_b = COALESCE((SELECT SUM(wager_amount) FROM public.predictions p WHERE p.match_id = m.id AND p.predicted_team = 'team_b'), 0);

-- 4. Setup the modified trigger to update odds and balance dynamically
CREATE OR REPLACE FUNCTION process_prediction_wager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_new_a_odds NUMERIC;
  v_new_b_odds NUMERIC;
  v_virtual_a NUMERIC;
  v_virtual_b NUMERIC;
BEGIN
  -- Deduct the wager amount from the user's balance
  UPDATE public.profiles
  SET balance = balance - NEW.wager_amount
  WHERE id = NEW.user_id;

  -- Update total wagers on the match
  UPDATE public.matches
  SET 
    total_wager_a = total_wager_a + CASE WHEN NEW.predicted_team = 'team_a' THEN NEW.wager_amount ELSE 0 END,
    total_wager_b = total_wager_b + CASE WHEN NEW.predicted_team = 'team_b' THEN NEW.wager_amount ELSE 0 END
  WHERE id = NEW.match_id
  RETURNING * INTO v_match;
  
  -- Calculate virtual pools using liquidity knob and initial odds
  v_virtual_a := (v_match.liquidity * (v_match.initial_a_odds_percent / 100.0)) + v_match.total_wager_a;
  v_virtual_b := (v_match.liquidity * (v_match.initial_b_odds_percent / 100.0)) + v_match.total_wager_b;
  
  -- Calculate new odds using net stake imbalance
  v_new_a_odds := ROUND((v_virtual_a / (v_virtual_a + v_virtual_b)) * 100.0, 2);
  v_new_b_odds := ROUND((v_virtual_b / (v_virtual_a + v_virtual_b)) * 100.0, 2);
  
  -- Apply Cap range (controlled band between 5% and 95%) 
  IF v_new_a_odds > 95 THEN
    v_new_a_odds := 95;
    v_new_b_odds := 5;
  ELSIF v_new_a_odds < 5 THEN
    v_new_a_odds := 5;
    v_new_b_odds := 95;
  END IF;

  -- Lock in minimum movement (tiny bets handled natively by AMM math / rounding above)
  
  -- Update the displayed odds
  UPDATE public.matches
  SET 
    team_a_odds_percent = v_new_a_odds,
    team_b_odds_percent = v_new_b_odds
  WHERE id = NEW.match_id;

  RETURN NEW;
END;
$$;
