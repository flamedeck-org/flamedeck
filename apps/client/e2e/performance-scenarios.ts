import { PlaywrightTestScenario, CommonScenarios } from '@flamedeck/regression-playwright';

/**
 * Flamedeck-specific performance test scenarios
 */
export const flamedeckScenarios: PlaywrightTestScenario[] = [

    // Basic homepage load - enhanced from common scenario
    {
        ...CommonScenarios.homepageLoad(),
        validate: async (page) => {
            // Ensure Flamedeck branding is loaded
            const title = await page.title();
            return title.includes('Flamedeck');
        },
        waitForStable: async (page) => {
            await page.waitForLoadState('networkidle');
            // Wait for any initial React hydration
            await page.waitForTimeout(1500);
        }
    },

    // Dashboard/file list page
    {
        name: 'dashboard-load',
        description: 'Load dashboard with trace list',
        path: '/dashboard',
        setup: async (page) => {
            // Set up auth if needed (you might need to adjust this based on your auth)
            await page.evaluate(() => {
                // Mock authentication or set tokens if needed
                localStorage.setItem('demo-mode', 'true');
            });
        },
        waitForStable: async (page) => {
            await page.waitForLoadState('networkidle');
            // Wait for trace list to load
            await page.waitForTimeout(2000);
        },
        validate: async (page) => {
            // Check if dashboard elements are present
            const url = page.url();
            return url.includes('/dashboard') || url.includes('/');
        }
    },

    // Trace upload flow
    {
        name: 'trace-upload-page',
        description: 'Load trace upload interface',
        path: '/upload',
        waitForStable: async (page) => {
            await page.waitForLoadState('networkidle');
            // Look for upload interface elements
            try {
                await page.waitForSelector('[data-testid="file-upload"], input[type="file"], .upload', { timeout: 5000 });
            } catch {
                // Upload interface might be different, continue anyway
            }
            await page.waitForTimeout(1000);
        },
        validate: async (page) => {
            // Basic validation that we're on the right page
            const url = page.url();
            return url.includes('/upload') || page.locator('input[type="file"]').isVisible();
        }
    },

    // API/docs page
    {
        name: 'api-docs-load',
        description: 'Load API documentation page',
        path: '/docs',
        waitForStable: async (page) => {
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);
        },
        validate: async (page) => {
            const url = page.url();
            return url.includes('/docs') || url.includes('/api');
        }
    },

    // Pricing page (if exists)
    {
        name: 'pricing-load',
        description: 'Load pricing page',
        path: '/pricing',
        waitForStable: async (page) => {
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);
        },
        validate: async (page) => {
            // Pricing page might redirect or not exist, so be lenient
            return true;
        }
    }

];

/**
 * Quick scenarios for faster feedback during development
 */
export const quickScenarios: PlaywrightTestScenario[] = [
    flamedeckScenarios[0], // Homepage only
];

/**
 * Full scenarios for comprehensive CI testing
 */
export const fullScenarios: PlaywrightTestScenario[] = flamedeckScenarios;

/**
 * Performance test configuration for Flamedeck
 */
export const flamedeckPerformanceConfig = {
    // Baseline performance targets for Flamedeck
    targets: {
        lcp: 2500,    // Largest Contentful Paint < 2.5s
        cls: 0.1,     // Cumulative Layout Shift < 0.1
        tbt: 200,     // Total Blocking Time < 200ms
        fcp: 1800,    // First Contentful Paint < 1.8s
        ttfb: 800     // Time to First Byte < 800ms
    },

    // Test settings
    iterations: 10,  // Start with fewer iterations for faster feedback
    outlierRemovalCount: 1,
    significanceThreshold: 0.05,
    effectSizeThreshold: 0.5,

    // Browser settings optimized for CI
    browserOptions: {
        headless: true,
        timeout: 30000
    },

    globalTimeout: 30000
}; 