ALTER TABLE public.traces
ADD COLUMN upload_source TEXT CHECK (upload_source IN ('api', 'web')) NOT NULL DEFAULT 'web'; 

COMMENT ON COLUMN public.traces.upload_source IS 'Indicates whether the trace was uploaded via the API or the web UI.';