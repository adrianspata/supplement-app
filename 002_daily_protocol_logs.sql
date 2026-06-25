-- Migration to create `daily_protocol_logs` table.
-- Run this directly in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.daily_protocol_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stack_item_id uuid NOT NULL REFERENCES public.user_stack_items(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    taken_at timestamp with time zone,
    scheduled_for date NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'skipped', 'missed')),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    -- Ensure only one log entry per item per day
    CONSTRAINT unique_user_stack_item_date UNIQUE (user_id, stack_item_id, scheduled_for)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_protocol_logs ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can select their own logs"
ON public.daily_protocol_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs"
ON public.daily_protocol_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
ON public.daily_protocol_logs FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
ON public.daily_protocol_logs FOR DELETE
USING (auth.uid() = user_id);

-- Create Index for faster querying
CREATE INDEX IF NOT EXISTS idx_daily_protocol_logs_user_date ON public.daily_protocol_logs(user_id, scheduled_for);
