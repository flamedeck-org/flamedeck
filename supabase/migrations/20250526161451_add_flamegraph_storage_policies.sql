-- Storage RLS policies for flamegraph-images bucket

-- Policy for authenticated users to read flamegraph images based on trace permissions
CREATE POLICY "Allow authenticated users to read flamegraph images based on trace permissions"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'flamegraph-images' AND
  EXISTS (
    SELECT 1 FROM public.traces t
    WHERE (t.light_image_path = CONCAT('flamegraph-images/', objects.name)
           OR t.dark_image_path = CONCAT('flamegraph-images/', objects.name))
    AND public.check_trace_permission(t.id, auth.uid(), 'viewer'::public.trace_role)
  )
);

-- Policy for anonymous users to read public flamegraph images
CREATE POLICY "Allow anonymous users to read public flamegraph images"
ON storage.objects
FOR SELECT TO anon
USING (
  bucket_id = 'flamegraph-images' AND
  EXISTS (
    SELECT 1 FROM public.traces t
    JOIN public.trace_permissions tp ON t.id = tp.trace_id
    WHERE (t.light_image_path = CONCAT('flamegraph-images/', objects.name)
           OR t.dark_image_path = CONCAT('flamegraph-images/', objects.name))
    AND tp.user_id IS NULL -- Public permission
    AND tp.role = 'viewer'
  )
);

-- Policy for service role to manage flamegraph images
CREATE POLICY "Allow service role to manage flamegraph images"
ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'flamegraph-images');
