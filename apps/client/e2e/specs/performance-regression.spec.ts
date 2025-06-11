import { test, expect } from '@playwright/test';
import { PlaywrightCIComparator } from '@flamedeck/regression-playwright';
import { quickScenarios, fullScenarios, flamedeckPerformanceConfig } from '../performance-scenarios';

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

    test('compare base vs PR performance', async () => {
        // Only run if this is a CI performance test
        test.skip(process.env.PERFORMANCE_TEST !== 'true', 'Not a performance test run');

        const baseUrl = process.env.BASE_URL;
        const prUrl = process.env.PR_URL;

        if (!baseUrl || !prUrl) {
            throw new Error('BASE_URL and PR_URL environment variables are required for performance comparison');
        }

        console.log('🚀 Starting CI performance comparison...');
        console.log(`Base URL: ${baseUrl}`);
        console.log(`PR URL: ${prUrl}`);

        const comparator = new PlaywrightCIComparator({
            baseUrl,
            treatmentUrl: prUrl,
            scenarios: fullScenarios,
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
            process.exit(1);
        } else {
            console.log('✅ No performance regressions found');
        }
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