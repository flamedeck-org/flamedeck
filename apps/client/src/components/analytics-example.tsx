import { useAnalytics } from '../lib/analytics';
import { Button } from './ui/button';

// Example component showing how to use analytics
export function ExampleComponent() {
    const analytics = useAnalytics();

    const handleTraceUpload = async (file: File) => {
        // Your upload logic here...

        // Track the upload
        await analytics.trackTraceUpload(file.size, file.type);
    };

    const handleButtonClick = async () => {
        // Track button clicks
        await analytics.trackButtonClick('upload_trace', 'header');
    };

    const handleSearch = async (query: string, results: any[]) => {
        // Track searches
        await analytics.trackSearch(query, results.length);
    };

    return (
        <div>
            <Button onClick={handleButtonClick}>
                Upload Trace
            </Button>

            {/* You can also track custom events */}
            <Button onClick={() => analytics.trackCustomEvent('feature_used', {
                feature: 'flamegraph_zoom',
                zoom_level: 2
            })}>
                Zoom Flamegraph
            </Button>
        </div>
    );
}

// You can also disable/enable analytics for privacy-conscious users
export function AnalyticsSettings() {
    const analytics = useAnalytics();

    return (
        <div>
            <Button onClick={() => analytics.disable()}>
                Disable Analytics
            </Button>
            <Button onClick={() => analytics.enable()}>
                Enable Analytics
            </Button>
        </div>
    );
} 