-- 1. Failsafe to prevent bets on non-open matches
CREATE OR REPLACE FUNCTION check_match_status_before_bet()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (SELECT status FROM public.matches WHERE id = NEW.match_id) != 'open' THEN
        RAISE EXCEPTION 'Cannot place bet on a market that is no longer open.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_open_match ON public.predictions;
CREATE TRIGGER enforce_open_match
BEFORE INSERT ON public.predictions
FOR EACH ROW
EXECUTE FUNCTION check_match_status_before_bet();

-- 2. Allow 'refunded' status for predictions
ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_status_check;
ALTER TABLE public.predictions ADD CONSTRAINT predictions_status_check CHECK (status IN ('pending', 'won', 'lost', 'refunded'));
