# Analytics Documentation

This document explains how to use the privacy-first analytics system in Flamedeck.

## Overview

Flamedeck uses a custom analytics system that stores data in our own Supabase database rather than using third-party services like Google Analytics. This gives us:

- **Complete data ownership** - All data stays in our database
- **Privacy-first approach** - No cookies, no cross-site tracking
- **GDPR compliance** - Users can opt-out, no personal data collection
- **Custom insights** - Track exactly what matters for our product

## Quick Start

### Basic Usage

```typescript
import { useAnalytics } from '@/lib/analytics';

function MyComponent() {
  const { trackCustomEvent } = useAnalytics();

  const handleButtonClick = () => {
    // Track a custom event (synchronous - batched automatically)
    trackCustomEvent('feature_used', {
      feature_name: 'export_trace',
      location: 'header_menu'
    });
  };

  return <button onClick={handleButtonClick}>Export</button>;
}
```

### Page View Tracking

Page views are automatically tracked when you include the analytics setup in your app:

```typescript
// In main.tsx (already configured)
import { setupAutoPageTracking } from '@/lib/analytics';

setupAutoPageTracking();
```

## Available Methods

### Core Tracking Methods

#### `trackPageView(path?: string)`
Tracks a page view. Called automatically for route changes.

```typescript
const { trackPageView } = useAnalytics();
trackPageView('/custom-path');
```

#### `trackCustomEvent(eventName: string, properties?: Record<string, any>)`
Tracks custom events with optional properties.

```typescript
const { trackCustomEvent } = useAnalytics();
trackCustomEvent('trace_shared', {
  share_type: 'public',
  trace_size_mb: 2.4,
  recipient_count: 3
});

// Trace-specific events (use custom events)
trackCustomEvent('trace_uploaded', {
  file_size_bytes: file.size,
  file_type: file.type
});

trackCustomEvent('trace_viewed', {
  trace_id: 'trace-123',
  view_duration_ms: 30000
});
```

### Convenience Methods

#### `trackButtonClick(buttonName: string, location?: string)`
Track button clicks with context.

```typescript
const { trackButtonClick } = useAnalytics();
trackButtonClick('upload_trace', 'sidebar');
trackButtonClick('sign_up', 'header_cta');
```

#### `trackSearch(query: string, resultCount?: number)`
Track search interactions.

```typescript
const { trackSearch } = useAnalytics();
trackSearch('performance issues', 15);
```

#### `trackError(errorType: string, errorMessage?: string)`
Track application errors. **Note:** For actual error monitoring, use Sentry.

```typescript
const { trackError } = useAnalytics();
trackError('upload_failed', 'File too large');
```

### Privacy Controls

#### `disable()` / `enable()`
Allow users to opt-out of analytics.

```typescript
// In settings component
const handleOptOut = () => analytics.disable();
const handleOptIn = () => analytics.enable();
```

## Event Properties

### Automatically Collected Data

The analytics system automatically collects:

- `session_id` - Anonymous session identifier (stored in sessionStorage)
- `user_id` - Only if user is logged in (nullable)
- `user_agent` - Browser information
- `device_type` - 'desktop', 'mobile', or 'tablet'
- `referrer` - Previous page URL
- `page_path` - Current page path
- `timestamp` - Client-side timestamp when event was triggered (milliseconds)
- `created_at` - Server-side timestamp when event was stored in database

### Custom Properties

You can add custom properties to any event:

```typescript
const { trackCustomEvent } = useAnalytics();
trackCustomEvent('flamegraph_zoomed', {
  zoom_level: 3,
  frame_count: 1250,
  view_type: 'time_ordered',
  duration_ms: 45000
});
```

**Best practices for properties:**
- Use snake_case for property names
- Keep values simple (strings, numbers, booleans)
- Don't include personal information
- Use consistent naming across similar events

### Event Batching

Analytics events are **synchronous** but **batched** for efficiency:
- Events are queued in memory and flushed every **5 seconds**
- Queue is flushed immediately if it contains **20+ events**
- Queue is flushed on page unload to avoid data loss
- Failed flushes are retried automatically (except on page unload)

**Timestamps**: Each event stores both the `timestamp` (when triggered on client) and `created_at` (when stored in database). Use `timestamp` for accurate timing analysis since there can be delays between triggering and flushing.

## Common Analytics Patterns

### User Journey Tracking

```typescript
const { trackCustomEvent } = useAnalytics();

// Onboarding steps
trackCustomEvent('onboarding_step_completed', {
  step: 'first_upload',
  step_number: 2,
  time_to_complete_ms: 45000
});

// Conversion events
trackCustomEvent('trial_converted', {
  trial_duration_days: 14,
  traces_uploaded: 5,
  features_used: ['ai_chat', 'sharing']
});
```

### Error Tracking

**For application errors, use Sentry for monitoring and alerting.** Use analytics for user-facing error events:

```typescript
import * as Sentry from '@sentry/react';

const { trackCustomEvent } = useAnalytics();

try {
  await uploadTrace(file);
} catch (error) {
  // Log to Sentry for monitoring
  Sentry.captureException(error, {
    tags: { operation: 'trace_upload' },
    extra: { fileSize: file.size, fileType: file.type }
  });
  
  // Track user impact for analytics
  trackCustomEvent('user_error_encountered', {
    error_category: 'upload_failed',
    file_size_mb: file.size / 1024 / 1024,
    user_action: 'retry_available'
  });
}
```

## React Hook Patterns

### Component-Level Tracking

The `useAnalytics` hook returns stable functions that won't cause re-renders:

```typescript
function TraceViewer({ traceId }: { traceId: string }) {
  const { trackCustomEvent } = useAnalytics(); // Stable functions
  const [viewStartTime] = useState(Date.now());

  useEffect(() => {
    // Track when trace loads
    trackCustomEvent('trace_viewed', { trace_id: traceId });
  }, [traceId, trackCustomEvent]);

  useEffect(() => {
    // Track view duration on unmount
    return () => {
      const viewDuration = Date.now() - viewStartTime;
      trackCustomEvent('trace_view_ended', {
        trace_id: traceId,
        view_duration_ms: viewDuration
      });
    };
  }, [traceId, viewStartTime, trackCustomEvent]);

  return <div>...</div>;
}
```

### Form Tracking

```typescript
function UploadForm() {
  const { trackCustomEvent } = useAnalytics();
  const [formStartTime, setFormStartTime] = useState<number | null>(null);

  const handleFormStart = useCallback(() => {
    setFormStartTime(Date.now());
    trackCustomEvent('form_started', { form_type: 'trace_upload' });
  }, [trackCustomEvent]);

  const handleFormSubmit = useCallback(async (data: FormData) => {
    const timeToComplete = formStartTime ? Date.now() - formStartTime : null;
    
    trackCustomEvent('form_submitted', {
      form_type: 'trace_upload',
      time_to_complete_ms: timeToComplete,
      field_count: Object.keys(data).length
    });

    try {
      await submitForm(data);
      trackCustomEvent('form_success', { form_type: 'trace_upload' });
    } catch (error) {
      // Use Sentry for error monitoring
      Sentry.captureException(error);
      trackCustomEvent('form_error', { form_type: 'trace_upload' });
    }
  }, [formStartTime, trackCustomEvent]);

  return (
    <form onFocus={handleFormStart} onSubmit={handleFormSubmit}>
      {/* form fields */}
    </form>
  );
}
```

## Testing Analytics

### Local Development

1. **Check the local Supabase database:**
   ```bash
   # Make sure local Supabase is running
   yarn supabase start
   
   # Open Supabase Studio
   # Go to: http://localhost:54323
   # Navigate to: Table Editor > analytics_events
   ```

2. **Console logging:**
   ```typescript
   // Analytics calls are silent by default
   // Check browser console for analytics.debug messages
   ```

3. **Test opt-out:**
   ```typescript
   // In browser console
   analytics.disable();
   // Try triggering events - they should not appear in database
   
   analytics.enable();
   // Events should start working again
   ```

### Testing Checklist

- [ ] Page views are tracked on route changes
- [ ] Custom events appear in database with correct properties
- [ ] User opt-out works (no events stored after `disable()`)
- [ ] Anonymous users can track events (user_id is null)
- [ ] Logged-in users have user_id populated
- [ ] No personal information is being stored
- [ ] Events fail gracefully (don't break app functionality)

## Best Practices

### Event Naming

- Use descriptive, consistent names: `trace_uploaded` not `upload`
- Use past tense: `button_clicked` not `button_click`
- Use snake_case: `feature_used` not `featureUsed`
- Be specific: `ai_chat_opened` not `modal_opened`

### Property Guidelines

- **DO:** Include relevant context
  ```typescript
  await analytics.trackCustomEvent('trace_shared', {
    share_type: 'public',
    trace_size_mb: 2.4,
    viewer_count: 1
  });
  ```

- **DON'T:** Include personal information
  ```typescript
  // ❌ Don't do this
  await analytics.trackCustomEvent('user_action', {
    email: user.email,  // Personal info
    ip_address: getIP() // Personal info
  });
  ```

### Performance

- Analytics calls are **synchronous** and never block the UI
- Events are **batched** for efficient network usage (5-second intervals)
- Failed flushes are automatically retried
- Keep property objects small (< 1KB when serialized)
- **Stable `useAnalytics` hook** prevents unnecessary re-renders

### Privacy

- Always allow users to opt-out
- Don't track sensitive user inputs
- Be transparent about what data is collected
- Regularly audit what events are being tracked

## Troubleshooting

### Events Not Appearing

1. Check if analytics is disabled:
   ```typescript
   // In browser console
   localStorage.getItem('flamedeck_analytics_disabled')
   ```

2. Check browser network tab for failed requests to `/rest/v1/analytics_events`

3. Verify local Supabase is running and migration was applied

### Database Permissions

If you get permission errors:
- Verify the RLS policies in the migration
- Check that `auth.uid()` is working for authenticated users
- Ensure anonymous users can insert (user_id is nullable)

### TypeScript Errors

If you get TypeScript errors about the analytics_events table:
```bash
# Regenerate types from local database
yarn supabase gen types typescript --local > packages/supabase-integration/src/index.ts
```

## Migration to Production

When ready to use analytics in production:

1. **Apply the migration to production:**
   ```bash
   yarn supabase db push
   ```

2. **Update production types:**
   ```bash
   yarn supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > packages/supabase-integration/src/index.ts
   ```

3. **Verify RLS policies are working correctly**

4. **Add monitoring for analytics errors**