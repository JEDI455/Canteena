-- Run this script in the Supabase SQL Editor.

-- Create profiles table linked to authentication
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user' NOT NULL,
  balance NUMERIC DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enables Row Level Security on the user profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
-- Users can read their own profile
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING ( auth.uid() = id );

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" 
ON profiles FOR SELECT 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Admins can update all profiles (e.g. adding money, changing roles)
CREATE POLICY "Admins can update all profiles" 
ON profiles FOR UPDATE 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, balance)
  VALUES (new.id, new.email, 'user', 100); -- Start with 100 fake money
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Create matches table
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  team_a_odds_percent NUMERIC NOT NULL CHECK (team_a_odds_percent >= 0 AND team_a_odds_percent <= 100),
  team_b_odds_percent NUMERIC NOT NULL CHECK (team_b_odds_percent >= 0 AND team_b_odds_percent <= 100),
  status TEXT DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'closed', 'resolved')),
  winner TEXT, -- 'team_a', 'team_b', or null
  end_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '7 days') NOT NULL,
  category TEXT DEFAULT 'other' NOT NULL CHECK (category IN ('politics', 'economics', 'sport', 'other')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Anyone can see matches
CREATE POLICY "Anyone can view matches."
ON matches FOR SELECT 
USING ( true );

-- Admins can insert, update, delete matches
CREATE POLICY "Admins can manage matches"
ON matches FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
