import {
    MetricCollection,
    ComparisonConfig,
    TestScenario,
    MeasurementPoint,
    ComparisonInput
} from '../types/metrics';
import {
    ComparisonResult,
    ScenarioComparisonResult,
    ComparisonSummary,
    MetricImpact
} from '../types/comparison';
import {
    StatisticalAnalysisOptions,
    OutlierRemovalOptions,
    RegressionAssessment,
    RegressionSeverity
} from '../types/statistics';
import { StatisticalAnalyzer } from '../analyzers/statistical-analyzer';

/**
 * Base CI comparator for orchestrating performance comparisons
 */
export abstract class CIComparator<T extends MetricCollection> {
    protected config: ComparisonConfig<T>;
    protected analysisOptions: StatisticalAnalysisOptions;
    protected outlierOptions: OutlierRemovalOptions;

    constructor(config: ComparisonConfig<T>) {
        this.config = config;
        this.analysisOptions = {
            significanceThreshold: config.significanceThreshold,
            effectSizeThreshold: config.effectSizeThreshold,
            confidenceLevel: 0.95
        };
        this.outlierOptions = {
            removeCount: config.outlierRemovalCount,
            method: 'trim'
        };
    }

    /**
     * Run the complete comparison process
     */
    async runComparison(
        baseUrl?: string,
        treatmentUrl?: string,
        customConfig?: Partial<ComparisonConfig<T>>
    ): Promise<ComparisonResult<T>> {
        const startTime = Date.now();
        const finalConfig = { ...this.config, ...customConfig };

        console.log(`Starting performance comparison with ${finalConfig.iterations} iterations...`);

        // Collect measurements using alternating pattern
        const measurements = await this.collectMeasurements(baseUrl, treatmentUrl, finalConfig);

        // Analyze each scenario
        const scenarioResults: ScenarioComparisonResult<T>[] = [];

        for (const scenario of finalConfig.scenarios) {
            console.log(`Analyzing scenario: ${scenario.name}`);

            const scenarioStartTime = Date.now();
            const result = await this.analyzeScenario(scenario, measurements, finalConfig);
            const scenarioExecutionTime = Date.now() - scenarioStartTime;

            scenarioResults.push({
                ...result,
                executionTime: scenarioExecutionTime,
                timestamp: new Date()
            });
        }

        // Calculate overall summary and assessment
        const summary = this.calculateSummary(scenarioResults);
        const overallAssessment = this.calculateOverallAssessment(scenarioResults);
        const totalExecutionTime = Date.now() - startTime;

        console.log(`Comparison completed in ${totalExecutionTime}ms`);

        return {
            summary,
            scenarios: scenarioResults,
            overallAssessment,
            config: finalConfig,
            timestamp: new Date(),
            totalExecutionTime
        };
    }

    /**
     * Collect measurements using alternating base/treatment pattern
     */
    private async collectMeasurements(
        baseUrl?: string,
        treatmentUrl?: string,
        config: ComparisonConfig<T> = this.config
    ): Promise<Map<string, { base: MeasurementPoint<T>[]; treatment: MeasurementPoint<T>[] }>> {

        const measurements = new Map<string, { base: MeasurementPoint<T>[]; treatment: MeasurementPoint<T>[] }>();

        // Initialize measurement collections for each scenario
        config.scenarios.forEach(scenario => {
            measurements.set(scenario.name, { base: [], treatment: [] });
        });

        // Alternating measurement pattern: base-treatment-base-treatment...
        for (let i = 0; i < config.iterations; i++) {
            const isBaseBranch = i % 2 === 0;

            console.log(`Iteration ${i + 1}/${config.iterations} (${isBaseBranch ? 'base' : 'treatment'})`);

            for (const scenario of config.scenarios) {
                try {
                    const metrics = await this.executeScenario(
                        scenario,
                        isBaseBranch ? 'base' : 'treatment',
                        baseUrl,
                        treatmentUrl
                    );

                    const measurement: MeasurementPoint<T> = {
                        timestamp: new Date(),
                        metrics,
                        metadata: {
                            iteration: i,
                            variant: isBaseBranch ? 'base' : 'treatment',
                            scenario: scenario.name
                        }
                    };

                    const scenarioMeasurements = measurements.get(scenario.name)!;
                    if (isBaseBranch) {
                        scenarioMeasurements.base.push(measurement);
                    } else {
                        scenarioMeasurements.treatment.push(measurement);
                    }

                } catch (error) {
                    console.error(`Error measuring scenario ${scenario.name}:`, error);
                    // Continue with other scenarios rather than failing completely
                }
            }

            // Small delay between iterations to prevent interference
            if (i < config.iterations - 1) {
                await this.delay(1000);
            }
        }

        return measurements;
    }

    /**
     * Analyze a single scenario's measurements
     */
    private async analyzeScenario(
        scenario: TestScenario<T>,
        allMeasurements: Map<string, { base: MeasurementPoint<T>[]; treatment: MeasurementPoint<T>[] }>,
        config: ComparisonConfig<T>
    ): Promise<Omit<ScenarioComparisonResult<T>, 'executionTime' | 'timestamp'>> {

        const measurements = allMeasurements.get(scenario.name);
        if (!measurements) {
            throw new Error(`No measurements found for scenario: ${scenario.name}`);
        }

        const { base, treatment } = measurements;

        if (base.length === 0 || treatment.length === 0) {
            throw new Error(`Insufficient measurements for scenario: ${scenario.name}`);
        }

        // Extract metric names from the first measurement
        const metricNames = Object.keys(base[0].metrics);
        const metricComparisons = [];

        // Analyze each metric
        for (const metricName of metricNames) {
            const baseValues = base.map(m => m.metrics[metricName]);
            const treatmentValues = treatment.map(m => m.metrics[metricName]);

            const comparison = StatisticalAnalyzer.analyzeRegression(
                baseValues,
                treatmentValues,
                metricName,
                this.analysisOptions,
                this.outlierOptions
            );

            metricComparisons.push(comparison);
        }

        // Calculate scenario-level assessment
        const assessment = this.calculateScenarioAssessment(metricComparisons);

        return {
            scenarioName: scenario.name,
            description: scenario.description,
            metricComparisons,
            assessment
        };
    }

    /**
     * Calculate assessment for a single scenario
     */
    private calculateScenarioAssessment(comparisons: any[]): RegressionAssessment {
        const regressions = comparisons.filter(c => c.isSignificantRegression);
        const improvements = comparisons.filter(c => c.isSignificantImprovement);

        let severity: RegressionSeverity = 'none';

        if (regressions.length > 0) {
            const maxEffectSize = Math.max(...regressions.map(r => Math.abs(r.effectSize)));

            if (maxEffectSize > 1.5) {
                severity = 'severe';
            } else if (maxEffectSize > 1.0) {
                severity = 'moderate';
            } else {
                severity = 'minor';
            }
        }

        const confidence = regressions.length > 0 ?
            Math.min(...regressions.map(r => 1 - r.pValue)) : 0;

        const affectedMetrics = regressions.map(r => r.metricName);

        let summary = '';
        if (regressions.length === 0 && improvements.length === 0) {
            summary = 'No significant changes detected';
        } else if (regressions.length === 0) {
            summary = `${improvements.length} metric(s) improved significantly`;
        } else if (improvements.length === 0) {
            summary = `${regressions.length} metric(s) regressed significantly`;
        } else {
            summary = `${regressions.length} regression(s), ${improvements.length} improvement(s)`;
        }

        return { severity, confidence, affectedMetrics, summary };
    }

    /**
     * Calculate overall comparison summary
     */
    private calculateSummary(scenarioResults: ScenarioComparisonResult<T>[]): ComparisonSummary {
        const totalScenarios = scenarioResults.length;
        let totalMetrics = 0;
        let significantRegressions = 0;
        let significantImprovements = 0;
        let neutralChanges = 0;

        const metricImpacts = new Map<string, {
            regressionCount: number;
            improvementCount: number;
            effectSizes: number[];
        }>();

        scenarioResults.forEach(scenario => {
            scenario.metricComparisons.forEach(metric => {
                totalMetrics++;

                // Track metric impacts
                if (!metricImpacts.has(metric.metricName)) {
                    metricImpacts.set(metric.metricName, {
                        regressionCount: 0,
                        improvementCount: 0,
                        effectSizes: []
                    });
                }

                const impact = metricImpacts.get(metric.metricName)!;
                impact.effectSizes.push(Math.abs(metric.effectSize));

                if (metric.isSignificantRegression) {
                    significantRegressions++;
                    impact.regressionCount++;
                } else if (metric.isSignificantImprovement) {
                    significantImprovements++;
                    impact.improvementCount++;
                } else {
                    neutralChanges++;
                }
            });
        });

        // Convert metric impacts to final format
        const mostImpactedMetrics: MetricImpact[] = Array.from(metricImpacts.entries())
            .map(([metricName, impact]) => ({
                metricName,
                regressionCount: impact.regressionCount,
                improvementCount: impact.improvementCount,
                averageEffectSize: impact.effectSizes.reduce((a, b) => a + b, 0) / impact.effectSizes.length,
                maxEffectSize: Math.max(...impact.effectSizes),
                severity: this.classifyMetricSeverity(impact.regressionCount, Math.max(...impact.effectSizes))
            }))
            .sort((a, b) => b.maxEffectSize - a.maxEffectSize)
            .slice(0, 5); // Top 5 most impacted

        return {
            totalScenarios,
            totalMetrics,
            significantRegressions,
            significantImprovements,
            neutralChanges,
            regressionRate: (significantRegressions / totalMetrics) * 100,
            improvementRate: (significantImprovements / totalMetrics) * 100,
            mostImpactedMetrics
        };
    }

    /**
     * Calculate overall assessment across all scenarios
     */
    private calculateOverallAssessment(scenarioResults: ScenarioComparisonResult<T>[]): RegressionAssessment {
        const allRegressions = scenarioResults.flatMap(s =>
            s.metricComparisons.filter(m => m.isSignificantRegression)
        );

        if (allRegressions.length === 0) {
            return {
                severity: 'none',
                confidence: 0,
                affectedMetrics: [],
                summary: 'No significant performance regressions detected'
            };
        }

        const maxEffectSize = Math.max(...allRegressions.map(r => Math.abs(r.effectSize)));
        const minPValue = Math.min(...allRegressions.map(r => r.pValue));

        let severity: RegressionSeverity = 'minor';
        if (maxEffectSize > 1.5) severity = 'severe';
        else if (maxEffectSize > 1.0) severity = 'moderate';

        const affectedMetrics = [...new Set(allRegressions.map(r => r.metricName))];
        const confidence = 1 - minPValue;

        return {
            severity,
            confidence,
            affectedMetrics,
            summary: `${allRegressions.length} significant regression(s) across ${affectedMetrics.length} metric(s)`
        };
    }

    /**
     * Classify metric severity based on regression count and effect size
     */
    private classifyMetricSeverity(regressionCount: number, maxEffectSize: number): 'low' | 'medium' | 'high' {
        if (regressionCount === 0) return 'low';
        if (regressionCount >= 3 || maxEffectSize > 1.5) return 'high';
        if (regressionCount >= 2 || maxEffectSize > 1.0) return 'medium';
        return 'low';
    }

    /**
     * Utility method for delays
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Abstract method to be implemented by concrete classes
     * This should execute a specific test scenario and return metrics
     */
    protected abstract executeScenario(
        scenario: TestScenario<T>,
        variant: 'base' | 'treatment',
        baseUrl?: string,
        treatmentUrl?: string
    ): Promise<T>;
} 