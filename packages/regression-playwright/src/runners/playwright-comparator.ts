import type { Browser, BrowserContext } from '@playwright/test';
import { Page, chromium } from '@playwright/test';
import type { ComparisonConfig, TestScenario } from '@flamedeck/regression-core';
import { CIComparator } from '@flamedeck/regression-core';
import type {
    PlaywrightMetrics,
    PlaywrightTestScenario,
    PlaywrightComparisonConfig,
} from '../types';
import { PlaywrightPerformanceCollector } from '../collectors/playwright-collector';

/**
 * Playwright-specific CI comparator that extends the base comparator
 */
export class PlaywrightCIComparator extends CIComparator<PlaywrightMetrics> {
    private browser?: Browser;
    private contexts: Map<string, BrowserContext> = new Map();
    private playwrightConfig: PlaywrightComparisonConfig;
    private originalScenarios: Map<string, PlaywrightTestScenario> = new Map();

    constructor(config: PlaywrightComparisonConfig) {
        // Convert Playwright config to base config
        const baseConfig: ComparisonConfig<PlaywrightMetrics> = {
            iterations: config.iterations,
            outlierRemovalCount: config.outlierRemovalCount,
            significanceThreshold: config.significanceThreshold,
            effectSizeThreshold: config.effectSizeThreshold,
            scenarios: config.scenarios.map((scenario) => ({
                name: scenario.name,
                description: scenario.description,
                execute: scenario.execute,
            })),
        };

        super(baseConfig);
        this.playwrightConfig = config;

        // Store original scenarios for later use (after super() call)
        config.scenarios.forEach((scenario) => {
            this.originalScenarios.set(scenario.name, scenario);
        });
    }

    /**
     * Run comparison using Playwright-specific configuration
     */
    async runPlaywrightComparison(): Promise<any> {
        await this.setupBrowser();

        try {
            const result = await this.runComparison(
                this.playwrightConfig.baseUrl,
                this.playwrightConfig.treatmentUrl
            );

            return result;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Execute a Playwright scenario and return metrics
     */
    protected async executeScenario(
        scenario: TestScenario<PlaywrightMetrics>,
        variant: 'base' | 'treatment',
        baseUrl?: string,
        treatmentUrl?: string
    ): Promise<PlaywrightMetrics> {
        // Get the original Playwright scenario with all properties preserved
        const playwrightScenario = this.originalScenarios.get(scenario.name);
        if (!playwrightScenario) {
            throw new Error(`Original scenario not found for: ${scenario.name}`);
        }

        const url = variant === 'base' ? baseUrl : treatmentUrl;

        if (!url) {
            throw new Error(`URL not provided for variant: ${variant}`);
        }

        // Get or create browser context for this variant
        const context = await this.getOrCreateContext(variant);
        const page = await context.newPage();

        try {
            // Debug logging
            console.log(
                `[DEBUG] Executing scenario: ${scenario.name}, variant: ${variant}, url: ${url}, path: ${playwrightScenario.path}`
            );

            // Validate URL before proceeding
            if (!url || url === 'undefined') {
                throw new Error(
                    `Invalid URL provided for scenario ${scenario.name} variant ${variant}: ${url}`
                );
            }

            // Set up error tracking
            await PlaywrightPerformanceCollector.setupErrorTracking(page);

            // Apply viewport settings if specified
            if (playwrightScenario.viewport) {
                await page.setViewportSize(playwrightScenario.viewport);
            }

            // Clear cache if requested
            if (playwrightScenario.clearCache) {
                await context.clearCookies();
                await context.clearPermissions();
            }

            // Navigate to the URL with the scenario path
            const fullUrl = `${url}${playwrightScenario.path}`;
            console.log(`[DEBUG] Navigating to: ${fullUrl}`);
            await page.goto(fullUrl, { waitUntil: 'networkidle' });

            // Run setup if provided
            if (playwrightScenario.setup) {
                await playwrightScenario.setup(page);
            }

            // Validate page loaded correctly if validation provided
            if (playwrightScenario.validate) {
                const isValid = await playwrightScenario.validate(page);
                if (!isValid) {
                    // Take screenshot on validation failure for debugging
                    try {
                        const fs = await import('fs').then(m => m.promises);
                        const path = await import('path');

                        // Debug: show current working directory
                        console.log(`[DEBUG] Current working directory: ${process.cwd()}`);

                        // Ensure test-results directory exists
                        const testResultsDir = 'test-results';
                        try {
                            await fs.mkdir(testResultsDir, { recursive: true });
                        } catch (mkdirError) {
                            // Directory might already exist, ignore error
                        }

                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const screenshotPath = path.join(testResultsDir, `validation-failure-${scenario.name}-${variant}-${timestamp}.png`);

                        await page.screenshot({
                            path: screenshotPath,
                            fullPage: true
                        });

                        console.log(`[DEBUG] Validation failure screenshot saved: ${path.resolve(screenshotPath)}`);

                        // Also save page HTML for debugging
                        const htmlPath = path.join(testResultsDir, `validation-failure-${scenario.name}-${variant}-${timestamp}.html`);
                        const html = await page.content();
                        await fs.writeFile(htmlPath, html);
                        console.log(`[DEBUG] Page HTML saved: ${path.resolve(htmlPath)}`);

                    } catch (screenshotError) {
                        console.warn('Failed to capture validation failure artifacts:', screenshotError);
                    }

                    throw new Error(`Page validation failed for scenario: ${scenario.name}`);
                }
            }

            // Perform interactions if provided
            if (playwrightScenario.interact) {
                await playwrightScenario.interact(page);
            }

            // Wait for stability
            if (playwrightScenario.waitForStable) {
                await playwrightScenario.waitForStable(page);
            } else {
                await PlaywrightPerformanceCollector.waitForPageStability(page);
            }

            // Check if page is still open before collecting metrics
            if (page.isClosed()) {
                throw new Error(`Page was closed during scenario execution: ${scenario.name}`);
            }

            // Collect performance metrics
            const metrics = await PlaywrightPerformanceCollector.collectAllMetrics(page);

            return metrics;
        } catch (error) {
            console.error(`Error executing scenario ${scenario.name} for ${variant}:`, error);
            throw error;
        } finally {
            await page.close();
        }
    }

    /**
     * Set up browser with configuration options
     */
    private async setupBrowser(): Promise<void> {
        const browserOptions = this.playwrightConfig.browserOptions || {};

        this.browser = await chromium.launch({
            headless: browserOptions.headless ?? true,
            slowMo: browserOptions.slowMo,
            timeout: browserOptions.timeout || 30000,
        });
    }

    /**
     * Get or create a browser context for a variant
     */
    private async getOrCreateContext(variant: 'base' | 'treatment'): Promise<BrowserContext> {
        if (!this.browser) {
            throw new Error('Browser not initialized');
        }

        if (this.contexts.has(variant)) {
            return this.contexts.get(variant)!;
        }

        const contextOptions: any = {
            ignoreHTTPSErrors: true,
            // Set global timeout
            timeout: this.playwrightConfig.globalTimeout || 30000,
        };

        // Apply device emulation if specified
        if (this.playwrightConfig.emulateDevice) {
            const { devices } = await import('@playwright/test');
            const device = devices[this.playwrightConfig.emulateDevice];
            if (device) {
                Object.assign(contextOptions, device);
            }
        }

        const context = await this.browser.newContext(contextOptions);

        // Set up network throttling if specified
        if (this.playwrightConfig.networkThrottling) {
            const cdp = await context.newCDPSession(await context.newPage());
            await cdp.send('Network.enable');
            await cdp.send('Network.emulateNetworkConditions', {
                offline: false,
                downloadThroughput: this.playwrightConfig.networkThrottling.downloadThroughput,
                uploadThroughput: this.playwrightConfig.networkThrottling.uploadThroughput,
                latency: this.playwrightConfig.networkThrottling.latency,
            });
            await cdp.detach();
        }

        this.contexts.set(variant, context);
        return context;
    }

    /**
     * Clean up browser and contexts
     */
    private async cleanup(): Promise<void> {
        // Close all contexts
        for (const context of this.contexts.values()) {
            await context.close();
        }
        this.contexts.clear();

        // Close browser
        if (this.browser) {
            await this.browser.close();
            this.browser = undefined;
        }
    }

    /**
     * Create a comparison configuration with sensible defaults
     */
    static createConfig(options: Partial<PlaywrightComparisonConfig>): PlaywrightComparisonConfig {
        return {
            iterations: 20,
            outlierRemovalCount: 2,
            significanceThreshold: 0.05,
            effectSizeThreshold: 0.5,
            baseUrl: '',
            treatmentUrl: '',
            scenarios: [],
            browserOptions: {
                headless: true,
                timeout: 30000,
            },
            globalTimeout: 30000,
            ...options,
        };
    }

    /**
     * Quick comparison method for simple scenarios
     */
    static async quickComparison(
        baseUrl: string,
        treatmentUrl: string,
        scenarios: PlaywrightTestScenario[],
        options: Partial<PlaywrightComparisonConfig> = {}
    ) {
        const config = this.createConfig({
            baseUrl,
            treatmentUrl,
            scenarios,
            ...options,
        });

        const comparator = new PlaywrightCIComparator(config);
        return await comparator.runPlaywrightComparison();
    }

    /**
     * Run a single scenario comparison (useful for debugging)
     */
    async runSingleScenario(
        scenario: PlaywrightTestScenario,
        iterations: number = 10
    ): Promise<{
        baseMetrics: PlaywrightMetrics[];
        treatmentMetrics: PlaywrightMetrics[];
    }> {
        await this.setupBrowser();

        try {
            const baseMetrics: PlaywrightMetrics[] = [];
            const treatmentMetrics: PlaywrightMetrics[] = [];

            // Alternating pattern for fair comparison
            for (let i = 0; i < iterations; i++) {
                const isBase = i % 2 === 0;

                const metrics = await this.executeScenario(
                    scenario,
                    isBase ? 'base' : 'treatment',
                    this.playwrightConfig.baseUrl,
                    this.playwrightConfig.treatmentUrl
                );

                if (isBase) {
                    baseMetrics.push(metrics);
                } else {
                    treatmentMetrics.push(metrics);
                }

                // Small delay between measurements
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            return { baseMetrics, treatmentMetrics };
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Get performance baseline for a URL (useful for establishing benchmarks)
     */
    static async getPerformanceBaseline(
        url: string,
        scenarios: PlaywrightTestScenario[],
        iterations: number = 10
    ): Promise<Map<string, PlaywrightMetrics[]>> {
        const config = this.createConfig({
            baseUrl: url,
            treatmentUrl: url, // Same URL for baseline
            scenarios,
            iterations: iterations * 2, // Double since we're only using base measurements
        });

        const comparator = new PlaywrightCIComparator(config);
        await comparator.setupBrowser();

        try {
            const results = new Map<string, PlaywrightMetrics[]>();

            for (const scenario of scenarios) {
                const metrics: PlaywrightMetrics[] = [];

                for (let i = 0; i < iterations; i++) {
                    const measurement = await comparator.executeScenario(scenario, 'base', url, url);

                    metrics.push(measurement);

                    // Small delay between measurements
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }

                results.set(scenario.name, metrics);
            }

            return results;
        } finally {
            await comparator.cleanup();
        }
    }
}
