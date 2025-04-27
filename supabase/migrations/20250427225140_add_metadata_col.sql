-- Drop the device_model column if it exists
alter table public.traces drop column if exists device_model;

-- Add the new metadata column
alter table public.traces add column metadata jsonb; 