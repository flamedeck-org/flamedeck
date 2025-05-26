-- Add flamegraph image path columns to traces table
ALTER TABLE public.traces 
ADD COLUMN light_image_path text,
ADD COLUMN dark_image_path text;

-- Add indexes for performance on non-null image paths
CREATE INDEX idx_traces_light_image_path ON public.traces(light_image_path) WHERE light_image_path IS NOT NULL;
CREATE INDEX idx_traces_dark_image_path ON public.traces(dark_image_path) WHERE dark_image_path IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.traces.light_image_path IS 'Storage path to the light mode flamegraph image PNG';
COMMENT ON COLUMN public.traces.dark_image_path IS 'Storage path to the dark mode flamegraph image PNG';
