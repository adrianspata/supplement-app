-- Migration to create the new `user_stack_items` table.
-- You can run this directly in the Supabase SQL Editor.

-- Create table
CREATE TABLE IF NOT EXISTS public.user_stack_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    timing text NOT NULL CHECK (timing IN ('morning', 'afternoon', 'evening', 'as_needed')),
    dosage text,
    frequency text DEFAULT 'Daily',
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    -- Ensure a user can only have one timing entry for a specific product
    CONSTRAINT unique_user_product_timing UNIQUE (user_id, product_id, timing)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_stack_items ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can select their own stack items"
ON public.user_stack_items FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stack items"
ON public.user_stack_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stack items"
ON public.user_stack_items FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stack items"
ON public.user_stack_items FOR DELETE
USING (auth.uid() = user_id);

-- Create Index for faster querying
CREATE INDEX IF NOT EXISTS idx_user_stack_items_user_id ON public.user_stack_items(user_id);
