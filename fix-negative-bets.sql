-- Run this script in your Supabase SQL Editor.
-- This ensures that balances cannot become negative due to race conditions or direct API calls.
-- And we double check predictions to disallow negative wagers, and transactions for correct amounts.

BEGIN;

-- Check and add constraint on profiles balance
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'balance_non_negative'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT balance_non_negative CHECK (balance >= 0);
  END IF;
END $$;

-- Check and add constraint on predictions wager_amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wager_amount_positive'
  ) THEN
    -- In case 'predictions_wager_amount_check' is the auto-generated name, adding an explicit one
    ALTER TABLE public.predictions ADD CONSTRAINT wager_amount_positive CHECK (wager_amount > 0);
  END IF;
END $$;

-- Check and add constraint on transactions (if it exists) to make sure wager deposits are correct
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'wager_is_negative_or_positive'
    ) THEN
      ALTER TABLE public.transactions ADD CONSTRAINT wager_is_negative_or_positive CHECK (
        (type = 'wager' AND amount < 0) OR (type != 'wager' AND amount > 0)
      );
    END IF;
  END IF;
END $$;

COMMIT;
