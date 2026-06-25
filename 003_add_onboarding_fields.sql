-- Migration to add onboarding personalization fields to `user_preferences`.
-- Run this directly in the Supabase SQL Editor.

ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS health_concerns text[],
ADD COLUMN IF NOT EXISTS exercise_frequency text,
ADD COLUMN IF NOT EXISTS sleep_duration text,
ADD COLUMN IF NOT EXISTS stress_level integer,
ADD COLUMN IF NOT EXISTS supplement_knowledge_level text,
ADD COLUMN IF NOT EXISTS purchase_drivers text[],
ADD COLUMN IF NOT EXISTS purchase_frequency text,
ADD COLUMN IF NOT EXISTS age_range text,
ADD COLUMN IF NOT EXISTS current_supplements text[];

