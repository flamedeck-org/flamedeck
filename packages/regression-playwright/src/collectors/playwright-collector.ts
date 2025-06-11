import { Page } from '@playwright/test';
import {
    PlaywrightMetrics,
    BrowserContext,
    PageLoadContext,
    PlaywrightMeasurementPoint
} from '../types/playwright-metrics';
import { CoreWebVitalsCollector } from './core-web-vitals';
import { NavigationTimingCollector } from './navigation-timing';
import { PaintTimingCollector } from './paint-timing';
import { ResourceTimingCollector } from './resource-timing';

/**
 * Main Playwright performance collector that orchestrates all metric collection
 */
export class PlaywrightPerformanceCollector {

    /**
     * Collect all performance metrics from a page
     */
    static async collectAllMetrics(page: Page): Promise<PlaywrightMetrics> {
        // Wait for the page to be fully loaded and stable
        await this.waitForPageStability(page);

        // Collect all metrics in parallel for efficiency
        const [
            coreWebVitals,
            navigationTiming,
            paintTiming,
            resourceTiming
        ] = await Promise.all([
            CoreWebVitalsCollector.collectCoreWebVitals(page),
            NavigationTimingCollector.collectNavigationTiming(page),
            PaintTimingCollector.collectPaintTiming(page),
            ResourceTimingCollector.collectResourceTiming(page)
        ]);

        // Combine all metrics into a single object
        return {
            // Core Web Vitals
            lcp: coreWebVitals.lcp,
            cls: coreWebVitals.cls,
            tbt: coreWebVitals.tbt,

            // Navigation timing
            ttfb: navigationTiming.ttfb,
            dnsLookup: navigationTiming.dnsLookup,
            tcpConnection: navigationTiming.tcpConnection,
            requestResponse: navigationTiming.requestResponse,
            domInteractive: navigationTiming.domInteractive,
            domContentLoaded: navigationTiming.domContentLoaded,
            loadEvent: navigationTiming.loadEvent,
            totalLoadTime: navigationTiming.totalLoadTime,

            // Paint timing
            fp: paintTiming.fp,
            fcp: paintTiming.fcp,

            // Resource metrics
            resourceCount: resourceTiming.resourceCount,
            totalResourceSize: resourceTiming.totalResourceSize,
            averageResourceLoadTime: resourceTiming.averageResourceLoadTime,
            largestResourceSize: resourceTiming.largestResourceSize,
            slowestResourceLoadTime: resourceTiming.slowestResourceLoadTime,

            // Long task metrics (already included in Core Web Vitals)
            longTaskCount: 0, // Will be populated if we have long task data
            longestTaskDuration: 0
        };
    }

    /**
     * Collect metrics with full context information
     */
    static async collectMeasurementPoint(
        page: Page,
        additionalContext?: Record<string, any>
    ): Promise<PlaywrightMeasurementPoint> {
        const timestamp = new Date();

        const [metrics, browserContext, pageLoadContext] = await Promise.all([
            this.collectAllMetrics(page),
            this.getBrowserContext(page),
            this.getPageLoadContext(page)
        ]);

        // Enhance long task metrics if available
        try {
            const longTaskMetrics = await CoreWebVitalsCollector.getLongTaskMetrics(page);
            metrics.longTaskCount = longTaskMetrics.longTaskCount;
            metrics.longestTaskDuration = longTaskMetrics.longestTaskDuration;
        } catch (error) {
            // Long task metrics might not be available in all environments
            console.debug('Long task metrics not available:', error);
        }

        // Collect any JavaScript errors or console warnings
        const { errors, warnings } = await this.getPageIssues(page);

        return {
            timestamp,
            metrics,
            browserContext,
            pageLoadContext: {
                ...pageLoadContext,
                ...additionalContext
            },
            errors,
            warnings
        };
    }

    /**
     * Wait for the page to be stable for accurate measurements
     */
    static async waitForPageStability(page: Page, timeout: number = 10000): Promise<void> {
        try {
            // Wait for network to be idle
            await page.waitForLoadState('networkidle', { timeout });

            // Wait for Core Web Vitals to stabilize
            await CoreWebVitalsCollector.waitForCoreWebVitals(page, timeout);

            // Additional stabilization time
            await page.waitForTimeout(1000);

        } catch (error) {
            console.warn('Page stability timeout, proceeding with measurement:', error);
            // Continue with measurement even if we hit timeout
        }
    }

    /**
     * Get browser context information
     */
    static async getBrowserContext(page: Page): Promise<BrowserContext> {
        return page.evaluate(() => {
            const viewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };

            return {
                browserName: 'chromium', // Default for Playwright
                browserVersion: navigator.userAgent,
                userAgent: navigator.userAgent,
                viewport,
                deviceScaleFactor: window.devicePixelRatio || 1,
                isMobile: /Mobi|Android/i.test(navigator.userAgent)
            };
        });
    }

    /**
     * Get page load context information
     */
    static async getPageLoadContext(page: Page): Promise<PageLoadContext> {
        const url = page.url();
        const timestamp = new Date();

        return {
            url,
            timestamp,
            cacheEnabled: true, // Default assumption
            // Network conditions and CPU throttling would be set by the test runner
        };
    }

    /**
     * Collect JavaScript errors and console warnings from the page
     */
    static async getPageIssues(page: Page): Promise<{
        errors: string[];
        warnings: string[];
    }> {
        // Get any JavaScript errors that occurred
        const errors = await page.evaluate(() => {
            const errorEvents: string[] = [];

            // Check if there's a global error handler that captured errors
            if ((window as any).__playwright_errors) {
                errorEvents.push(...(window as any).__playwright_errors);
            }

            return errorEvents;
        });

        // Console warnings are typically captured by Playwright's console event listeners
        // This would need to be set up in the test runner
        const warnings: string[] = [];

        return { errors, warnings };
    }

    /**
     * Check if all performance APIs are supported
     */
    static async checkApiSupport(page: Page): Promise<{
        coreWebVitals: {
            lcp: boolean;
            cls: boolean;
            longtask: boolean;
        };
        navigationTiming: boolean;
        paintTiming: {
            firstPaint: boolean;
            firstContentfulPaint: boolean;
        };
        resourceTiming: boolean;
    }> {
        const [coreWebVitals, navigationTiming, paintTiming, resourceTiming] = await Promise.all([
            CoreWebVitalsCollector.isCoreWebVitalsSupported(page),
            NavigationTimingCollector.isNavigationTimingSupported(page),
            PaintTimingCollector.isPaintTimingSupported(page),
            ResourceTimingCollector.isResourceTimingSupported(page)
        ]);

        return {
            coreWebVitals,
            navigationTiming,
            paintTiming,
            resourceTiming
        };
    }

    /**
     * Get performance insights and recommendations
     */
    static async getPerformanceInsights(page: Page): Promise<{
        overallScore: number;
        recommendations: string[];
        criticalIssues: string[];
        metrics: PlaywrightMetrics;
    }> {
        const metrics = await this.collectAllMetrics(page);

        const recommendations: string[] = [];
        const criticalIssues: string[] = [];
        let totalScore = 0;
        let scoreCount = 0;

        // Analyze Core Web Vitals
        if (metrics.lcp > 4000) {
            criticalIssues.push(`Poor LCP: ${metrics.lcp.toFixed(0)}ms (should be < 2.5s)`);
        } else if (metrics.lcp > 2500) {
            recommendations.push(`Improve LCP: ${metrics.lcp.toFixed(0)}ms (target < 2.5s)`);
        }

        if (metrics.cls > 0.25) {
            criticalIssues.push(`Poor CLS: ${metrics.cls.toFixed(3)} (should be < 0.1)`);
        } else if (metrics.cls > 0.1) {
            recommendations.push(`Improve CLS: ${metrics.cls.toFixed(3)} (target < 0.1)`);
        }

        if (metrics.tbt > 600) {
            criticalIssues.push(`Poor TBT: ${metrics.tbt.toFixed(0)}ms (should be < 200ms)`);
        } else if (metrics.tbt > 200) {
            recommendations.push(`Improve TBT: ${metrics.tbt.toFixed(0)}ms (target < 200ms)`);
        }

        // Analyze resource performance
        const resourceScore = ResourceTimingCollector.calculateResourceScore({
            resourceCount: metrics.resourceCount,
            totalResourceSize: metrics.totalResourceSize,
            averageResourceLoadTime: metrics.averageResourceLoadTime,
            largestResourceSize: metrics.largestResourceSize,
            slowestResourceLoadTime: metrics.slowestResourceLoadTime
        });

        recommendations.push(...resourceScore.issues);
        totalScore += resourceScore.score;
        scoreCount++;

        // Calculate overall score
        const coreWebVitalsScore = this.calculateCoreWebVitalsScore(metrics);
        totalScore += coreWebVitalsScore;
        scoreCount++;

        const overallScore = scoreCount > 0 ? totalScore / scoreCount : 0;

        return {
            overallScore,
            recommendations,
            criticalIssues,
            metrics
        };
    }

    /**
     * Calculate Core Web Vitals score
     */
    private static calculateCoreWebVitalsScore(metrics: PlaywrightMetrics): number {
        let score = 100;

        // LCP scoring
        if (metrics.lcp > 4000) score -= 40;
        else if (metrics.lcp > 2500) score -= 20;

        // CLS scoring
        if (metrics.cls > 0.25) score -= 30;
        else if (metrics.cls > 0.1) score -= 15;

        // TBT scoring
        if (metrics.tbt > 600) score -= 30;
        else if (metrics.tbt > 200) score -= 15;

        return Math.max(0, score);
    }

    /**
     * Set up error tracking for a page
     */
    static async setupErrorTracking(page: Page): Promise<void> {
        // Inject error tracking script
        await page.addInitScript(() => {
            (window as any).__playwright_errors = [];

            window.addEventListener('error', (event) => {
                (window as any).__playwright_errors.push(`JavaScript Error: ${event.message} at ${event.filename}:${event.lineno}`);
            });

            window.addEventListener('unhandledrejection', (event) => {
                (window as any).__playwright_errors.push(`Unhandled Promise Rejection: ${event.reason}`);
            });
        });
    }
} 