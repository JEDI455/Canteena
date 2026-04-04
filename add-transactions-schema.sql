-- Migration to add Transactions history

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'wager', 'payout', 'bonus', 'admin_adjustment')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" 
ON public.transactions FOR SELECT 
USING ( auth.uid() = user_id );

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions" 
ON public.transactions FOR SELECT 
USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );

-- Admins can insert transactions
CREATE POLICY "Admins can insert transactions" 
ON public.transactions FOR INSERT 
WITH CHECK ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );

-- Replace process_prediction_wager to also insert a transaction
CREATE OR REPLACE FUNCTION public.process_prediction_wager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Deduct the wager amount from the user's balance
  UPDATE public.profiles
  SET balance = balance - NEW.wager_amount
  WHERE id = NEW.user_id;

  -- Insert transaction for the wager
  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (NEW.user_id, -NEW.wager_amount, 'wager', 'Wager placed on match');
  
  RETURN NEW;
END;
$$;

-- Replace handle_new_user to insert initial bonus transaction
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, balance)
  VALUES (new.id, new.email, 'user', 100); -- Start with 100 fake money
  
  -- Insert bonus transaction
  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (new.id, 100, 'bonus', 'Initial signup bonus');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
