import { test, expect } from '@playwright/test';
import { PlaywrightCIComparator } from '@flamedeck/regression-playwright';
import { quickScenarios, fullScenarios, flamedeckPerformanceConfig } from '../performance-scenarios';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { createServer } from 'http';
import { createReadStream, statSync } from 'fs';
import { URL } from 'url';

const execAsync = promisify(exec);

// Helper to serve static files for local testing
async function createStaticServer(buildPath: string, port: number): Promise<() => void> {
    return new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url!, `http://localhost:${port}`);
            let filePath = path.join(buildPath, url.pathname === '/' ? 'index.html' : url.pathname);

            try {
                const stat = statSync(filePath);
                if (stat.isDirectory()) {
                    filePath = path.join(filePath, 'index.html');
                }

                const stream = createReadStream(filePath);

                // Set content type
                if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html');
                else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
                else if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');

                // Enable CORS for local testing
                res.setHeader('Access-Control-Allow-Origin', '*');

                stream.pipe(res);
                stream.on('error', () => {
                    res.statusCode = 404;
                    res.end('Not Found');
                });
            } catch {
                res.statusCode = 404;
                res.end('Not Found');
            }
        });

        server.listen(port, () => {
            resolve(() => server.close());
        });

        server.on('error', reject);
    });
}

// Performance regression tests - only run when environment variables are set
test.describe('Performance Regression Tests', () => {

    test('should not have performance regressions (quick)', async () => {
        const baseUrl = process.env.BASE_URL;
        const prUrl = process.env.PR_URL || process.env.TEST_URL;

        // Skip if URLs not provided
        test.skip(!baseUrl || !prUrl, 'BASE_URL and PR_URL must be set for regression testing');

        console.log(`Comparing performance: ${baseUrl} vs ${prUrl}`);

        const result = await PlaywrightCIComparator.quickComparison(
            baseUrl!,
            prUrl!,
            quickScenarios,
            {
                ...flamedeckPerformanceConfig,
                iterations: 6, // Quick test with fewer iterations
                outlierRemovalCount: 1
            }
        );

        // Log detailed results
        console.log('\n=== Performance Comparison Results ===');
        console.log(`Total scenarios: ${result.summary.totalScenarios}`);
        console.log(`Total metrics: ${result.summary.totalMetrics}`);
        console.log(`Significant regressions: ${result.summary.significantRegressions}`);
        console.log(`Significant improvements: ${result.summary.significantImprovements}`);
        console.log(`Regression rate: ${result.summary.regressionRate.toFixed(1)}%`);
        console.log(`Overall assessment: ${result.overallAssessment.summary}`);

        // Log scenario details
        result.scenarios.forEach((scenario: any) => {
            console.log(`\n--- ${scenario.scenarioName} ---`);
            scenario.metricComparisons.forEach((metric: any) => {
                const change = metric.percentageChange > 0 ? '+' : '';
                const status = metric.isSignificantRegression ? '⚠️ REGRESSION' :
                    metric.isSignificantImprovement ? '✅ IMPROVEMENT' :
                        '➖ NEUTRAL';
                console.log(`  ${metric.metricName}: ${change}${metric.percentageChange.toFixed(1)}% ${status}`);
            });
        });

        // Fail test if significant regressions found
        if (result.summary.significantRegressions > 0) {
            const regressedMetrics = result.overallAssessment.affectedMetrics.join(', ');
            throw new Error(
                `Performance regression detected! ${result.summary.significantRegressions} metrics regressed: ${regressedMetrics}`
            );
        }

        // The test passes if no regressions found
        expect(result.summary.significantRegressions).toBe(0);
    });

    test('should not have performance regressions (comprehensive)', async () => {
        const baseUrl = process.env.BASE_URL;
        const prUrl = process.env.PR_URL || process.env.TEST_URL;

        // Skip if URLs not provided
        test.skip(!baseUrl || !prUrl, 'BASE_URL and PR_URL must be set for regression testing');
        test.skip(process.env.QUICK_TEST === 'true', 'Skipping comprehensive test in quick mode');

        console.log(`Running comprehensive performance comparison: ${baseUrl} vs ${prUrl}`);

        const result = await PlaywrightCIComparator.quickComparison(
            baseUrl!,
            prUrl!,
            fullScenarios,
            flamedeckPerformanceConfig
        );

        // Detailed logging
        console.log('\n=== Comprehensive Performance Results ===');
        console.log(JSON.stringify(result.summary, null, 2));

        // Create performance report
        const report = generatePerformanceReport(result);
        console.log('\n=== Performance Report ===');
        console.log(report);

        // Fail if regressions found
        expect(result.summary.significantRegressions).toBe(0);
    });

});

// Conditional test suite that only runs for CI performance comparisons
test.describe('CI Performance Comparison', () => {
    // Only run if this is a CI performance test and not local mode
    test.skip(process.env.PERFORMANCE_TEST !== 'true' || process.env.LOCAL_MODE === 'true');

    test('compare base vs PR performance', async () => {
        const baseUrl = process.env.BASE_URL;
        const prUrl = process.env.PR_URL;

        if (!baseUrl || !prUrl) {
            throw new Error('BASE_URL and PR_URL environment variables are required for CI performance comparison');
        }

        console.log('🚀 Starting CI performance comparison...');
        console.log(`Base URL: ${baseUrl}`);
        console.log(`PR URL: ${prUrl}`);

        const scenarios = process.env.PERFORMANCE_SCENARIOS
            ? process.env.PERFORMANCE_SCENARIOS.split(',').map(name => {
                const scenario = [...quickScenarios, ...fullScenarios].find(s => s.name === name.trim());
                if (!scenario) throw new Error(`Scenario ${name} not found`);
                return scenario;
            })
            : fullScenarios;

        const comparator = new PlaywrightCIComparator({
            baseUrl,
            treatmentUrl: prUrl,
            scenarios,
            ...flamedeckPerformanceConfig,
            iterations: parseInt(process.env.PERFORMANCE_ITERATIONS || '10'),
            outlierRemovalCount: parseInt(process.env.OUTLIER_REMOVAL_COUNT || '1')
        });

        const result = await comparator.runPlaywrightComparison();

        // Generate CI-friendly output
        const report = generateCIReport(result);
        console.log(report);

        // Write results for potential GitHub comment
        if (process.env.GITHUB_STEP_SUMMARY) {
            await writeGitHubSummary(result);
        }

        // Exit with appropriate code
        if (result.summary.significantRegressions > 0) {
            console.error('❌ Performance regressions detected');
            const regressedMetrics = result.overallAssessment.affectedMetrics.join(', ');
            throw new Error(
                `Performance regression detected! ${result.summary.significantRegressions} metrics regressed: ${regressedMetrics}`
            );
        } else {
            console.log('✅ No performance regressions found');
        }
    });
});

// Local Performance Comparison Tests
test.describe('Local Performance Comparison', () => {
    // Only run if this is a local performance test
    test.skip(process.env.PERFORMANCE_TEST !== 'true' || process.env.LOCAL_MODE !== 'true');

    test('compare base vs current build performance', async ({ page, browserName }) => {
        const baseBuildPath = process.env.PERFORMANCE_BASE_BUILD;
        const currentBuildPath = process.env.PERFORMANCE_CURRENT_BUILD;
        const iterations = parseInt(process.env.PERFORMANCE_ITERATIONS || '5', 10);

        if (!baseBuildPath || !currentBuildPath) {
            throw new Error('Local mode requires PERFORMANCE_BASE_BUILD and PERFORMANCE_CURRENT_BUILD environment variables');
        }

        console.log(`📂 Base build: ${baseBuildPath}`);
        console.log(`📂 Current build: ${currentBuildPath}`);

        const scenarioNames = process.env.PERFORMANCE_SCENARIOS?.split(',') || [];
        const scenarios = scenarioNames.length > 0
            ? [...quickScenarios, ...fullScenarios].filter(s => scenarioNames.includes(s.name))
            : quickScenarios; // Default to quick scenarios for local testing

        // Start servers for both builds
        const basePort = 3001;
        const currentPort = 3002;

        console.log('🚀 Starting static servers...');
        const stopBaseServer = await createStaticServer(baseBuildPath, basePort);
        const stopCurrentServer = await createStaticServer(currentBuildPath, currentPort);

        try {
            const baseUrl = `http://localhost:${basePort}`;
            const currentUrl = `http://localhost:${currentPort}`;

            console.log(`📍 Base server: ${baseUrl}`);
            console.log(`📍 Current server: ${currentUrl}`);

            // Use the PlaywrightCIComparator but with local URLs
            const comparator = new PlaywrightCIComparator({
                baseUrl,
                treatmentUrl: currentUrl,
                scenarios,
                ...flamedeckPerformanceConfig,
                iterations,
                outlierRemovalCount: 1 // Less aggressive outlier removal for local testing
            });

            const result = await comparator.runPlaywrightComparison();

            // Generate detailed local report
            const report = generatePerformanceReport(result);
            console.log('\n=== Local Performance Report ===');
            console.log(report);

            // Fail if regressions found
            if (result.summary.significantRegressions > 0) {
                const regressedMetrics = result.overallAssessment.affectedMetrics.join(', ');
                throw new Error(
                    `Performance regression detected! ${result.summary.significantRegressions} metrics regressed: ${regressedMetrics}`
                );
            }

            expect(result.summary.significantRegressions).toBe(0);

        } finally {
            console.log('🛑 Stopping static servers...');
            stopBaseServer();
            stopCurrentServer();
        }
    });
});

// Quick Performance Check (for development/baseline collection)
test.describe('Performance Baseline Collection', () => {
    // Skip if in any performance test mode
    test.skip(() => process.env.PERFORMANCE_TEST === 'true');

    test('collect performance metrics (baseline)', async ({ page, browserName }) => {
        console.log('📊 Collecting baseline performance metrics...');

        const scenarios = quickScenarios;

        for (const scenario of scenarios) {
            console.log(`\n🧪 Testing scenario: ${scenario.name}`);
            console.log(`📍 URL: ${scenario.url}`);

            // Go to the page
            await page.goto(scenario.url);
            await scenario.waitFor(page);

            // Collect performance metrics
            const metrics = await page.evaluate(() => {
                return new Promise((resolve) => {
                    const result: any = {};
                    let navigationComplete = false;
                    let paintComplete = false;
                    let lcpComplete = false;

                    const checkComplete = () => {
                        if (navigationComplete && paintComplete && lcpComplete) {
                            resolve(result);
                        }
                    };

                    // Navigation timing
                    new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        entries.forEach((entry) => {
                            if (entry.entryType === 'navigation') {
                                const nav = entry as PerformanceNavigationTiming;
                                result.ttfb = nav.responseStart - nav.requestStart;
                                result.domContentLoaded = nav.domContentLoadedEventEnd - nav.startTime;
                                result.loadComplete = nav.loadEventEnd - nav.startTime;
                                navigationComplete = true;
                                checkComplete();
                            }
                        });
                    }).observe({ entryTypes: ['navigation'] });

                    // Paint timing
                    new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        entries.forEach((entry) => {
                            if (entry.name === 'first-contentful-paint') {
                                result.fcp = entry.startTime;
                            } else if (entry.name === 'first-paint') {
                                result.fp = entry.startTime;
                            }
                        });
                        paintComplete = true;
                        checkComplete();
                    }).observe({ entryTypes: ['paint'] });

                    // LCP
                    new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        const lastEntry = entries[entries.length - 1];
                        if (lastEntry) {
                            result.lcp = lastEntry.startTime;
                        }
                        lcpComplete = true;
                        checkComplete();
                    }).observe({ entryTypes: ['largest-contentful-paint'] });

                    // Fallback timeout
                    setTimeout(() => {
                        resolve(result);
                    }, 5000);
                });
            });

            // Log results (informational only)
            console.log(`📊 Metrics for ${scenario.name}:`);
            Object.entries(metrics as any).forEach(([metric, value]) => {
                console.log(`  ${metric}: ${(value as number).toFixed(2)}ms`);
            });
        }

        console.log('\n✅ Baseline collection complete');
    });
});

/**
 * Generate a human-readable performance report
 */
function generatePerformanceReport(result: any): string {
    let report = '## Performance Comparison Report\n\n';

    report += `**Summary:**\n`;
    report += `- Total scenarios tested: ${result.summary.totalScenarios}\n`;
    report += `- Total metrics compared: ${result.summary.totalMetrics}\n`;
    report += `- Regressions: ${result.summary.significantRegressions}\n`;
    report += `- Improvements: ${result.summary.significantImprovements}\n`;
    report += `- Neutral: ${result.summary.neutralChanges}\n\n`;

    if (result.summary.significantRegressions > 0) {
        report += `**⚠️ Regressions Found:**\n`;
        result.scenarios.forEach((scenario: any) => {
            const regressions = scenario.metricComparisons.filter((m: any) => m.isSignificantRegression);
            if (regressions.length > 0) {
                report += `- ${scenario.scenarioName}:\n`;
                regressions.forEach((metric: any) => {
                    report += `  - ${metric.metricName}: +${metric.percentageChange.toFixed(1)}% (p=${metric.pValue.toFixed(3)})\n`;
                });
            }
        });
        report += '\n';
    }

    if (result.summary.significantImprovements > 0) {
        report += `**✅ Improvements Found:**\n`;
        result.scenarios.forEach((scenario: any) => {
            const improvements = scenario.metricComparisons.filter((m: any) => m.isSignificantImprovement);
            if (improvements.length > 0) {
                report += `- ${scenario.scenarioName}:\n`;
                improvements.forEach((metric: any) => {
                    report += `  - ${metric.metricName}: ${metric.percentageChange.toFixed(1)}% (p=${metric.pValue.toFixed(3)})\n`;
                });
            }
        });
    }

    return report;
}

/**
 * Generate CI-friendly report 
 */
function generateCIReport(result: any): string {
    const status = result.summary.significantRegressions > 0 ? 'FAILED' : 'PASSED';
    const icon = result.summary.significantRegressions > 0 ? '❌' : '✅';

    return `
${icon} Performance Test ${status}

Summary:
- Scenarios: ${result.summary.totalScenarios}
- Metrics: ${result.summary.totalMetrics}  
- Regressions: ${result.summary.significantRegressions}
- Improvements: ${result.summary.significantImprovements}
- Overall: ${result.overallAssessment.summary}
`;
}

/**
 * Write GitHub Actions summary
 */
async function writeGitHubSummary(result: any): Promise<void> {
    const fs = require('fs').promises;
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;

    if (!summaryFile) return;

    const report = generatePerformanceReport(result);
    await fs.appendFile(summaryFile, report);
} 