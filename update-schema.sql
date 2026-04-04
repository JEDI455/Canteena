-- Run this in your Supabase SQL Editor to add the newly required columns for predictions.
ALTER TABLE matches 
ADD COLUMN end_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '7 days') NOT NULL,
ADD COLUMN category TEXT DEFAULT 'other' NOT NULL CHECK (category IN ('politics', 'economics', 'sport', 'other'));
