import { Page } from '@playwright/test';
import { CoreWebVitals, LongTaskMetrics } from '../types/playwright-metrics';

/**
 * Core Web Vitals collector based on Checkly's performance guide
 * https://www.checklyhq.com/learn/playwright/performance/
 */
export class CoreWebVitalsCollector {

    /**
     * Collect all Core Web Vitals metrics from a page
     */
    static async collectCoreWebVitals(page: Page): Promise<CoreWebVitals> {
        const [lcp, cls, tbt] = await Promise.all([
            this.getLargestContentfulPaint(page),
            this.getCumulativeLayoutShift(page),
            this.getTotalBlockingTime(page)
        ]);

        return { lcp, cls, tbt };
    }

    /**
     * Get Largest Contentful Paint (LCP) from the page
     */
    static async getLargestContentfulPaint(page: Page): Promise<number> {
        try {
            const lcp = await page.evaluate(() => {
                return new Promise<number>((resolve) => {
                    new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        // The last entry is the largest contentful paint
                        const largestPaintEntry = entries.at(-1) as PerformanceEntry & { startTime: number };
                        resolve(largestPaintEntry?.startTime || 0);
                    }).observe({
                        type: 'largest-contentful-paint',
                        buffered: true
                    });

                    // Fallback timeout in case LCP doesn't fire
                    setTimeout(() => resolve(0), 3000);
                });
            });

            return lcp;
        } catch (error) {
            console.warn('Failed to collect LCP:', error instanceof Error ? error.message : String(error));
            return 0;
        }
    }

    /**
     * Get Cumulative Layout Shift (CLS) from the page
     */
    static async getCumulativeLayoutShift(page: Page): Promise<number> {
        try {
            const cls = await page.evaluate(() => {
                return new Promise<number>((resolve) => {
                    let CLS = 0;

                    new PerformanceObserver((list) => {
                        const entries = list.getEntries();

                        entries.forEach((entry: any) => {
                            // Only count layout shifts that didn't happen near a user input
                            if (!entry.hadRecentInput) {
                                CLS += entry.value;
                            }
                        });

                        resolve(CLS);
                    }).observe({
                        type: 'layout-shift',
                        buffered: true
                    });

                    // Resolve after a reasonable time to capture layout shifts
                    setTimeout(() => resolve(CLS), 2000);
                });
            });

            return cls;
        } catch (error) {
            console.warn('Failed to collect CLS:', error instanceof Error ? error.message : String(error));
            return 0;
        }
    }

    /**
     * Get Total Blocking Time (TBT) - lab equivalent of First Input Delay
     */
    static async getTotalBlockingTime(page: Page): Promise<number> {
        const longTaskMetrics = await this.getLongTaskMetrics(page);
        return longTaskMetrics.totalBlockingTime;
    }

    /**
     * Get detailed long task metrics for TBT calculation
     */
    static async getLongTaskMetrics(page: Page): Promise<LongTaskMetrics> {
        try {
            const longTaskData = await page.evaluate(() => {
                return new Promise<LongTaskMetrics>((resolve) => {
                    let totalBlockingTime = 0;
                    let longTaskCount = 0;
                    let longestTaskDuration = 0;

                    new PerformanceObserver((list) => {
                        const perfEntries = list.getEntries();

                        for (const perfEntry of perfEntries) {
                            longTaskCount++;
                            longestTaskDuration = Math.max(longestTaskDuration, perfEntry.duration);

                            // Tasks longer than 50ms contribute to blocking time
                            // We subtract 50ms because the first 50ms of any task is not blocking
                            totalBlockingTime += Math.max(0, perfEntry.duration - 50);
                        }

                        resolve({
                            longTaskCount,
                            totalBlockingTime,
                            longestTaskDuration
                        });
                    }).observe({
                        type: 'longtask',
                        buffered: true
                    });

                    // Resolve with current values after timeout if no long tasks
                    setTimeout(() => resolve({
                        longTaskCount,
                        totalBlockingTime,
                        longestTaskDuration
                    }), 3000);
                });
            });

            return longTaskData;
        } catch (error) {
            console.warn('Failed to collect long task metrics:', error instanceof Error ? error.message : String(error));
            return {
                longTaskCount: 0,
                totalBlockingTime: 0,
                longestTaskDuration: 0
            };
        }
    }

    /**
     * Wait for Core Web Vitals to be available and stable
     */
    static async waitForCoreWebVitals(page: Page, timeout: number = 10000): Promise<void> {
        await page.evaluate((timeoutMs) => {
            return new Promise<void>((resolve, reject) => {
                const startTime = Date.now();
                let lcpFired = false;
                let clsStable = false;

                // Check for LCP
                new PerformanceObserver(() => {
                    lcpFired = true;
                    checkCompletion();
                }).observe({
                    type: 'largest-contentful-paint',
                    buffered: true
                });

                // Check for CLS stability (no layout shifts for 500ms)
                let lastLayoutShift = 0;
                new PerformanceObserver(() => {
                    lastLayoutShift = Date.now();
                }).observe({
                    type: 'layout-shift',
                    buffered: true
                });

                function checkCompletion() {
                    const elapsed = Date.now() - startTime;
                    const clsIsStable = Date.now() - lastLayoutShift > 500;

                    if (lcpFired && clsIsStable) {
                        clsStable = true;
                        resolve();
                    } else if (elapsed > timeoutMs) {
                        resolve(); // Resolve anyway after timeout
                    } else {
                        setTimeout(checkCompletion, 100);
                    }
                }

                // Start checking
                setTimeout(checkCompletion, 100);
            });
        }, timeout);
    }

    /**
     * Check if Core Web Vitals are supported in the current browser
     */
    static async isCoreWebVitalsSupported(page: Page): Promise<{
        lcp: boolean;
        cls: boolean;
        longtask: boolean;
    }> {
        return page.evaluate(() => {
            const isObserverSupported = 'PerformanceObserver' in window;

            if (!isObserverSupported) {
                return { lcp: false, cls: false, longtask: false };
            }

            try {
                // Test LCP support
                const lcpSupported = PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint');

                // Test CLS support  
                const clsSupported = PerformanceObserver.supportedEntryTypes.includes('layout-shift');

                // Test Long Task support
                const longtaskSupported = PerformanceObserver.supportedEntryTypes.includes('longtask');

                return {
                    lcp: lcpSupported,
                    cls: clsSupported,
                    longtask: longtaskSupported
                };
            } catch (error) {
                return { lcp: false, cls: false, longtask: false };
            }
        });
    }
} 