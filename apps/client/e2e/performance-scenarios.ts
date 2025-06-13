import { PlaywrightTestScenario, CommonScenarios } from '@flamedeck/regression-playwright';

/**
 * Flamedeck-specific performance test scenarios
 */
export const flamedeckScenarios: PlaywrightTestScenario[] = [

    // Basic homepage load - enhanced from common scenario
    {
        ...CommonScenarios.homepageLoad(),
        validate: async (page) => {
            await page.waitForSelector('#page-title', { timeout: 5000 });
        },
    },
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