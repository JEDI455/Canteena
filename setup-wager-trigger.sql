-- Run this in your Supabase SQL Editor
-- This trigger will securely deduct the user's balance whenever they place a prediction.

CREATE OR REPLACE FUNCTION process_prediction_wager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS and update the profile
AS $$
BEGIN
  -- Deduct the wager amount from the user's balance
  UPDATE public.profiles
  SET balance = balance - NEW.wager_amount
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_prediction_placed ON public.predictions;
CREATE TRIGGER on_prediction_placed
  AFTER INSERT ON public.predictions
  FOR EACH ROW EXECUTE PROCEDURE process_prediction_wager();
