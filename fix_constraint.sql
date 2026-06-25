-- Force add the unique constraint to user_stack_items
ALTER TABLE public.user_stack_items
DROP CONSTRAINT IF EXISTS unique_user_product_timing;

ALTER TABLE public.user_stack_items
ADD CONSTRAINT unique_user_product_timing UNIQUE (user_id, product_id, timing);

-- Also just to be safe, force add the unique constraint to daily_protocol_logs
ALTER TABLE public.daily_protocol_logs
DROP CONSTRAINT IF EXISTS unique_user_stack_item_date;

ALTER TABLE public.daily_protocol_logs
ADD CONSTRAINT unique_user_stack_item_date UNIQUE (user_id, stack_item_id, scheduled_for);
