import { test, expect } from '@playwright/test';
import { PlaywrightPerformanceCollector } from '@flamedeck/regression-playwright';
import { flamedeckPerformanceConfig } from '../performance-scenarios';

test.describe('App Startup', () => {
    test('should load the homepage successfully', async ({ page }) => {
        await page.goto('/');

        // Wait for the page to load
        await page.waitForLoadState('networkidle');

        // Check that the page has loaded by looking for the document title
        await expect(page).toHaveTitle(/Flamedeck/);

        // Check that the page doesn't have any critical JavaScript errors
        const errors: string[] = [];
        page.on('pageerror', (error) => {
            errors.push(error.message);
        });

        // Wait a bit to catch any immediate errors
        await page.waitForTimeout(2000);

        // Assert no critical errors occurred
        expect(errors).toEqual([]);
    });

    test('should have accessible main content', async ({ page }) => {
        await page.goto('/');

        // Wait for the page to load
        await page.waitForLoadState('networkidle');

        // Check that the main content area is visible
        const main = page.locator('main, [role="main"], #root');
        await expect(main.first()).toBeVisible();
    });

    test('should be responsive', async ({ page }) => {
        await page.goto('/');

        // Test desktop viewport
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForLoadState('networkidle');
        await expect(page.locator('body')).toBeVisible();

        // Test tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForLoadState('networkidle');
        await expect(page.locator('body')).toBeVisible();

        // Test mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForLoadState('networkidle');
        await expect(page.locator('body')).toBeVisible();
    });

    test('should collect performance metrics (informational)', async ({ page }) => {
        // Set up performance tracking
        await PlaywrightPerformanceCollector.setupErrorTracking(page);

        await page.goto('/');

        // Wait for page stability 
        await PlaywrightPerformanceCollector.waitForPageStability(page);

        // Collect performance metrics
        const metrics = await PlaywrightPerformanceCollector.collectAllMetrics(page);

        // Log metrics for visibility and debugging
        console.log('📊 Performance Metrics (Current Branch):', {
            lcp: `${metrics.lcp.toFixed(0)}ms`,
            cls: metrics.cls.toFixed(3),
            tbt: `${metrics.tbt.toFixed(0)}ms`,
            fcp: `${metrics.fcp.toFixed(0)}ms`,
            ttfb: `${metrics.ttfb.toFixed(0)}ms`,
            resourceCount: metrics.resourceCount,
            totalResourceSize: `${(metrics.totalResourceSize / 1024 / 1024).toFixed(2)}MB`
        });

        // Get performance insights for recommendations
        const insights = await PlaywrightPerformanceCollector.getPerformanceInsights(page);

        // Log recommendations if any
        if (insights.recommendations.length > 0) {
            console.log('💡 Performance Recommendations:', insights.recommendations);
        }

        // Log critical issues but don't fail (only fail on regressions vs master)
        if (insights.criticalIssues.length > 0) {
            console.warn('⚠️ Performance Concerns (not failing):', insights.criticalIssues);
        }

        console.log(`🎯 Overall Performance Score: ${insights.overallScore.toFixed(0)}/100`);

        // Only assert that we successfully collected metrics (no performance thresholds)
        expect(metrics.lcp).toBeGreaterThan(0);
        expect(metrics.resourceCount).toBeGreaterThan(0);
        expect(typeof metrics.cls).toBe('number');
    });

    test('should support performance API', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check that all performance APIs are available
        const apiSupport = await PlaywrightPerformanceCollector.checkApiSupport(page);

        // Log API support for debugging
        console.log('Performance API Support:', apiSupport);

        // Core Web Vitals should be supported in modern browsers
        expect(apiSupport.coreWebVitals.lcp).toBe(true);
        expect(apiSupport.navigationTiming).toBe(true);
        expect(apiSupport.paintTiming.firstContentfulPaint).toBe(true);
        expect(apiSupport.resourceTiming).toBe(true);
    });
}); 