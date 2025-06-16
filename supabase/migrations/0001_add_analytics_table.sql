-- Add analytics table for tracking page views and custom events
CREATE TABLE public.analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Event details
  event_type TEXT NOT NULL, -- 'page_view', 'custom_event', etc.
  event_name TEXT, -- For custom events
  page_path TEXT,
  
  -- User/session info (anonymous)
  session_id TEXT NOT NULL, -- Client-generated session ID
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Optional if user is logged in
  
  -- Technical details
  user_agent TEXT,
  referrer TEXT,
  
  -- Location (can be derived from IP on server-side if needed)
  country TEXT,
  city TEXT,
  
  -- Device info
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  
  -- Custom properties (flexible JSON for any additional data)
  properties JSONB,
  
  -- Client-side timestamp (when event was triggered, not when it was flushed)
  timestamp BIGINT NOT NULL
  
  -- Privacy-friendly: we don't store IP addresses or other PII
);

-- Add indexes for common queries
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at);
CREATE INDEX idx_analytics_events_timestamp ON public.analytics_events(timestamp);
CREATE INDEX idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_page_path ON public.analytics_events(page_path);
CREATE INDEX idx_analytics_events_session_id ON public.analytics_events(session_id);
CREATE INDEX idx_analytics_events_user_id ON public.analytics_events(user_id);

-- Add RLS policies
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own analytics events
CREATE POLICY "Users can insert analytics events" ON public.analytics_events
  FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );

-- Nobody can read analytics events via the client (only you can see them in Supabase dashboard)
CREATE POLICY "No client access to analytics events" ON public.analytics_events
  FOR SELECT 
  USING (false); 