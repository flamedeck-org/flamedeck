import { Page } from '@playwright/test';
import { TestScenario } from '@flamedeck/regression-core';
import { PlaywrightMetrics } from './playwright-metrics';

/**
 * Playwright-specific test scenario with page setup and validation
 */
export interface PlaywrightTestScenario extends TestScenario<PlaywrightMetrics> {
    /** Path to append to the base URL */
    path: string;

    /** Optional setup function to run before measurement */
    setup?: (page: Page) => Promise<void>;

    /** Optional function to wait for page stability before measuring */
    waitForStable?: (page: Page) => Promise<void>;

    /** Optional validation function to ensure page loaded correctly */
    validate?: (page: Page) => Promise<boolean>;

    /** Optional function to perform interactions before final measurement */
    interact?: (page: Page) => Promise<void>;

    /** Viewport settings for this scenario */
    viewport?: {
        width: number;
        height: number;
    };

    /** Whether to clear cache before this scenario */
    clearCache?: boolean;

    /** Custom timeout for this scenario (ms) */
    timeout?: number;
}

/**
 * Configuration for Playwright comparisons
 */
export interface PlaywrightComparisonConfig {
    /** Number of measurement iterations */
    iterations: number;

    /** Number of outliers to remove from each sample */
    outlierRemovalCount: number;

    /** Base branch URL */
    baseUrl: string;

    /** Treatment/PR branch URL */
    treatmentUrl: string;

    /** Test scenarios to execute */
    scenarios: PlaywrightTestScenario[];

    /** Statistical significance threshold */
    significanceThreshold: number;

    /** Effect size threshold */
    effectSizeThreshold: number;

    /** Browser options */
    browserOptions?: {
        headless?: boolean;
        slowMo?: number;
        timeout?: number;
    };

    /** Network throttling options */
    networkThrottling?: {
        downloadThroughput: number;
        uploadThroughput: number;
        latency: number;
    };

    /** Whether to emulate mobile device */
    emulateDevice?: string;

    /** Global timeout for all operations */
    globalTimeout?: number;
}

/**
 * Pre-defined common scenarios
 */
export const CommonScenarios = {
    /**
     * Basic homepage load test
     */
    homepageLoad: (): PlaywrightTestScenario => ({
        name: 'homepage-load',
        description: 'Load homepage and measure Core Web Vitals',
        path: '/',
        waitForStable: async (page) => {
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000); // Allow for any final renders
        },
        validate: async (page) => {
            // Wait for the h1 heading to be loaded
            await page.waitForSelector('h1:has-text("Performance Debugging")');
            return true;
        }
    }),

    /**
     * Navigation test with interaction
     */
    navigationTest: (fromPath: string, toPath: string, selector: string): PlaywrightTestScenario => ({
        name: `navigate-${fromPath.replace('/', '')}-to-${toPath.replace('/', '')}`,
        description: `Navigate from ${fromPath} to ${toPath}`,
        path: fromPath,
        setup: async (page) => {
            await page.waitForLoadState('networkidle');
        },
        interact: async (page) => {
            await page.click(selector);
            await page.waitForURL(`**${toPath}`);
        },
        waitForStable: async (page) => {
            await page.waitForLoadState('networkidle');
        }
    }),

    /**
     * Form interaction test
     */
    formInteraction: (path: string, formActions: (page: Page) => Promise<void>): PlaywrightTestScenario => ({
        name: 'form-interaction',
        description: 'Measure performance during form interactions',
        path,
        setup: async (page) => {
            await page.waitForLoadState('networkidle');
        },
        interact: formActions,
        waitForStable: async (page) => {
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);
        }
    }),

    /**
     * File upload test
     */
    fileUpload: (path: string, fileSelector: string, filePath: string): PlaywrightTestScenario => ({
        name: 'file-upload',
        description: 'Measure performance during file upload',
        path,
        setup: async (page) => {
            await page.waitForLoadState('networkidle');
        },
        interact: async (page) => {
            await page.setInputFiles(fileSelector, filePath);
            // Wait for upload processing
            await page.waitForTimeout(2000);
        },
        waitForStable: async (page) => {
            await page.waitForLoadState('networkidle');
        }
    }),

    /**
     * Search functionality test
     */
    searchTest: (path: string, searchSelector: string, searchTerm: string): PlaywrightTestScenario => ({
        name: 'search-functionality',
        description: 'Measure search performance',
        path,
        setup: async (page) => {
            await page.waitForLoadState('networkidle');
        },
        interact: async (page) => {
            await page.fill(searchSelector, searchTerm);
            await page.press(searchSelector, 'Enter');
        },
        waitForStable: async (page) => {
            await page.waitForLoadState('networkidle');
            // Wait for search results to load
            await page.waitForTimeout(1000);
        }
    })
};

/**
 * Device presets for mobile testing
 */
export const DevicePresets = {
    desktop: {
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        isMobile: false
    },
    tablet: {
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
        isMobile: false
    },
    mobile: {
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
        isMobile: true
    }
};

/**
 * Network condition presets
 */
export const NetworkPresets = {
    fast3G: {
        downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
        uploadThroughput: 750 * 1024 / 8,           // 750 Kbps
        latency: 150
    },
    slow3G: {
        downloadThroughput: 500 * 1024 / 8,         // 500 Kbps
        uploadThroughput: 500 * 1024 / 8,           // 500 Kbps
        latency: 300
    },
    wifi: {
        downloadThroughput: 30 * 1024 * 1024 / 8,   // 30 Mbps
        uploadThroughput: 15 * 1024 * 1024 / 8,     // 15 Mbps
        latency: 20
    }
}; 