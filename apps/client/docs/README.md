# Flamedeck Client Documentation

This folder contains documentation for the Flamedeck client application.

## Available Documentation

### [Analytics Documentation](./analytics.md)
Comprehensive guide for implementing analytics in the Flamedeck client app:
- How to track page views and custom events
- Privacy-first analytics approach
- Best practices for event naming and properties
- Testing and troubleshooting guides
- React patterns and examples

## Quick Links

### Analytics Setup
- **Basic usage**: See [Quick Start section](./analytics.md#quick-start)
- **Available methods**: See [Available Methods section](./analytics.md#available-methods)
- **Testing locally**: See [Testing Analytics section](./analytics.md#testing-analytics)

### Common Tasks
- **Track a button click**: `const { trackButtonClick } = useAnalytics(); trackButtonClick('button_name', 'location')`
- **Track custom events**: `const { trackCustomEvent } = useAnalytics(); trackCustomEvent('event_name', { properties })`
- **Enable/disable analytics**: `const { enable, disable } = useAnalytics(); enable() / disable()`

## Development Workflow

1. **Local Testing**: Make sure local Supabase is running (`yarn supabase start`)
2. **Add Analytics**: Import `useAnalytics` hook and track relevant events
3. **Test Events**: Check Supabase Studio at http://localhost:54323 for events
4. **Production Deploy**: Apply migration with `yarn supabase db push`

## Contributing to Documentation

When adding new features that should be tracked:
1. Update the analytics documentation with new event examples
2. Follow the naming conventions outlined in the analytics guide
3. Add examples for common use cases
4. Update the testing checklist if needed

## Architecture

The analytics system:
- Stores data in our own Supabase database (no third-party services)
- Uses no cookies or cross-site tracking
- Allows users to opt-out completely
- Automatically tracks page views and supports custom events
- Is GDPR compliant by design

For technical implementation details, see the [analytics.md](./analytics.md) file. 