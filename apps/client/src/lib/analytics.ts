import { useCallback, useMemo } from 'react';
import { supabase } from '../integrations/supabase/client';

// Generate a persistent session ID for anonymous tracking
function getSessionId(): string {
    const storageKey = 'flamedeck_session_id';
    let sessionId = sessionStorage.getItem(storageKey);

    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(storageKey, sessionId);
    }

    return sessionId;
}

// Detect device type
function getDeviceType(): string {
    const width = window.innerWidth;
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
}

// Get basic browser info without PII
function getBrowserInfo() {
    return {
        user_agent: navigator.userAgent,
        device_type: getDeviceType(),
    };
}

interface TrackEventOptions {
    event_name?: string;
    page_path?: string;
    properties?: Record<string, any>;
}

interface QueuedEvent {
    event_type: string;
    event_name?: string;
    page_path: string;
    session_id: string;
    user_id: string | null;
    referrer: string | null;
    properties: Record<string, any> | null;
    user_agent: string;
    device_type: string;
    timestamp: number;
}

class Analytics {
    private sessionId: string;
    private isEnabled: boolean = true;
    private eventQueue: QueuedEvent[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private isFlushingQueue: boolean = false;

    private static readonly FLUSH_INTERVAL = 5000; // 5 seconds
    private static readonly MAX_QUEUE_SIZE = 20;

    constructor() {
        this.sessionId = getSessionId();
        this.setupFlushTimer();
        this.setupUnloadHandler();
    }

    // Disable analytics (for privacy-conscious users)
    disable() {
        this.isEnabled = false;
        localStorage.setItem('flamedeck_analytics_disabled', 'true');
    }

    // Enable analytics
    enable() {
        this.isEnabled = true;
        localStorage.removeItem('flamedeck_analytics_disabled');
    }

    // Check if analytics is disabled
    private checkEnabled(): boolean {
        if (localStorage.getItem('flamedeck_analytics_disabled') === 'true') {
            this.isEnabled = false;
        }
        return this.isEnabled;
    }

    // Setup periodic flush timer
    private setupFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flushQueue();
        }, Analytics.FLUSH_INTERVAL);
    }

    // Setup page unload handler to flush remaining events
    private setupUnloadHandler() {
        const handleUnload = () => {
            this.flushQueue(true); // Synchronous flush on unload
        };

        window.addEventListener('beforeunload', handleUnload);
        window.addEventListener('pagehide', handleUnload);
    }

    // Flush the event queue to the database
    private async flushQueue(synchronous = false) {
        if (this.isFlushingQueue || this.eventQueue.length === 0) return;

        this.isFlushingQueue = true;
        const eventsToFlush = [...this.eventQueue];
        this.eventQueue = [];

        try {
            // Get current user for all events in batch
            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id || null;

            // Update all events with current user ID and prepare for insertion
            const eventsWithUserId = eventsToFlush.map(event => ({
                ...event,
                user_id: userId,
            }));

            await supabase.from('analytics_events').insert(eventsWithUserId);
        } catch (error) {
            // Silently fail - analytics shouldn't break the app
            console.debug('Analytics flush error:', error);

            // If not synchronous (page unload), put events back in queue to retry later
            if (!synchronous) {
                this.eventQueue.unshift(...eventsToFlush);
            }
        } finally {
            this.isFlushingQueue = false;
        }
    }

    // Track a generic event (synchronous - queues the event)
    trackEvent(event_type: string, options: TrackEventOptions = {}) {
        if (!this.checkEnabled()) return;

        const queuedEvent: QueuedEvent = {
            event_type,
            event_name: options.event_name,
            page_path: options.page_path || window.location.pathname,
            session_id: this.sessionId,
            user_id: null, // Will be set during flush
            referrer: document.referrer || null,
            properties: options.properties || null,
            timestamp: Date.now(),
            ...getBrowserInfo(),
        };

        this.eventQueue.push(queuedEvent);

        // Flush immediately if queue is getting large
        if (this.eventQueue.length >= Analytics.MAX_QUEUE_SIZE) {
            this.flushQueue();
        }
    }

    // Track page views
    trackPageView(path?: string) {
        this.trackEvent('page_view', {
            page_path: path,
        });
    }

    // Track custom events with properties
    trackCustomEvent(eventName: string, properties?: Record<string, any>) {
        this.trackEvent('custom_event', {
            event_name: eventName,
            properties,
        });
    }

    // Convenience methods for common events
    trackButtonClick(buttonName: string, location?: string) {
        this.trackCustomEvent('button_click', {
            button_name: buttonName,
            location,
        });
    }



    trackSearch(query: string, resultCount?: number) {
        this.trackCustomEvent('search', {
            query: query.toLowerCase(), // normalize for privacy
            result_count: resultCount,
        });
    }

    trackError(errorType: string, errorMessage?: string) {
        this.trackCustomEvent('error', {
            error_type: errorType,
            error_message: errorMessage,
        });
    }
}

// Export a singleton instance
export const analytics = new Analytics();

// Auto-track page views for SPAs
let lastPath = '';

export function setupAutoPageTracking() {
    // Track initial page load
    analytics.trackPageView();

    // Track route changes (for React Router)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
        originalPushState.apply(history, args);
        handleRouteChange();
    };

    history.replaceState = function (...args) {
        originalReplaceState.apply(history, args);
        handleRouteChange();
    };

    window.addEventListener('popstate', handleRouteChange);

    function handleRouteChange() {
        const currentPath = window.location.pathname;
        if (currentPath !== lastPath) {
            lastPath = currentPath;
            // Small delay to ensure the new page has loaded
            setTimeout(() => {
                analytics.trackPageView();
            }, 100);
        }
    }
}

// Hook for React components
export function useAnalytics() {
    const trackEvent = useCallback((event_type: string, options?: TrackEventOptions) => {
        analytics.trackEvent(event_type, options);
    }, []);

    const trackPageView = useCallback((path?: string) => {
        analytics.trackPageView(path);
    }, []);

    const trackCustomEvent = useCallback((eventName: string, properties?: Record<string, any>) => {
        analytics.trackCustomEvent(eventName, properties);
    }, []);

    const trackButtonClick = useCallback((buttonName: string, location?: string) => {
        analytics.trackButtonClick(buttonName, location);
    }, []);



    const trackSearch = useCallback((query: string, resultCount?: number) => {
        analytics.trackSearch(query, resultCount);
    }, []);

    const trackError = useCallback((errorType: string, errorMessage?: string) => {
        analytics.trackError(errorType, errorMessage);
    }, []);

    const disable = useCallback(() => {
        analytics.disable();
    }, []);

    const enable = useCallback(() => {
        analytics.enable();
    }, []);

    return useMemo(() => ({
        trackEvent,
        trackPageView,
        trackCustomEvent,
        trackButtonClick,
        trackSearch,
        trackError,
        disable,
        enable,
    }), [
        trackEvent,
        trackPageView,
        trackCustomEvent,
        trackButtonClick,
        trackSearch,
        trackError,
        disable,
        enable,
    ]);
} 