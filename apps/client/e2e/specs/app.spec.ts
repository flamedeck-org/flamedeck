import { test, expect } from '@playwright/test';

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
}); 