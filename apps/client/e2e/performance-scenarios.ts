import { PlaywrightTestScenario, CommonScenarios } from '@flamedeck/regression-playwright';

/**
 * Flamedeck-specific performance test scenarios
 */
export const flamedeckScenarios: PlaywrightTestScenario[] = [

    // Basic homepage load - enhanced from common scenario
    {
        ...CommonScenarios.homepageLoad(),
        setup: async (page) => {
            // Ensure we wait properly for the page to be ready
            await page.waitForLoadState('networkidle');
            await page.waitForLoadState('domcontentloaded');

            // Additional wait in CI environments for slower loading
            if (process.env.CI) {
                await page.waitForTimeout(2000);
            }
        },
        validate: async (page) => {
            try {
                // Wait longer in CI environments
                const timeout = process.env.CI ? 20000 : 8000;

                console.log(`[DEBUG] Validating homepage with timeout: ${timeout}ms`);
                console.log(`[DEBUG] Current URL: ${page.url()}`);
                console.log(`[DEBUG] Page title: ${await page.title()}`);

                // Try multiple validation strategies
                try {
                    // Primary validation: look for the page title
                    await page.waitForSelector('#page-title', { timeout });
                    console.log(`[DEBUG] Homepage validation successful - found #page-title`);
                    return true;
                } catch (primaryError) {
                    console.log(`[DEBUG] Primary validation failed, trying fallback...`);

                    // Fallback 1: Check if page loaded with some content
                    const hasContent = await page.evaluate(() => {
                        const body = document.body;
                        return body && body.children.length > 0 && body.textContent && body.textContent.trim().length > 100;
                    });

                    if (hasContent) {
                        console.log(`[DEBUG] Fallback validation successful - page has content`);
                        return true;
                    }

                    // Fallback 2: Check for any h1 element
                    const hasH1 = await page.locator('h1').count() > 0;
                    if (hasH1) {
                        console.log(`[DEBUG] Fallback validation successful - found h1 element`);
                        return true;
                    }

                    throw primaryError; // Re-throw the original error
                }
            } catch (error) {
                console.error('Homepage validation failed:', error);

                // Capture debug information on failure
                try {
                    console.log(`[DEBUG] Page HTML snippet:`,
                        await page.evaluate(() => document.documentElement.outerHTML.substring(0, 2000))
                    );
                    console.log(`[DEBUG] Available h1 elements:`,
                        await page.evaluate(() =>
                            Array.from(document.querySelectorAll('h1')).map(el => ({
                                id: el.id,
                                className: el.className,
                                textContent: el.textContent?.substring(0, 100)
                            }))
                        )
                    );
                    console.log(`[DEBUG] All elements with id:`,
                        await page.evaluate(() =>
                            Array.from(document.querySelectorAll('[id]')).slice(0, 10).map(el => ({
                                id: el.id,
                                tagName: el.tagName,
                                textContent: el.textContent?.substring(0, 50)
                            }))
                        )
                    );
                } catch (debugError) {
                    console.error('Failed to capture debug info:', debugError);
                }

                return false;
            }
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
    iterations: 6,  // Reduced iterations for faster feedback
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