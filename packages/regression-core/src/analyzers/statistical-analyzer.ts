import {
    SampleStatistics,
    StatisticalComparison,
    StatisticalAnalysisOptions,
    MannWhitneyResult,
    OutlierRemovalOptions
} from '../types/statistics';
import { OutlierDetector } from './outlier-detector';
import {
    mean,
    median,
    standardDeviation,
    variance,
    cohensD,
    percentageChange,
    confidenceInterval
} from '../utils/math';

/**
 * Main statistical analyzer for regression detection
 */
export class StatisticalAnalyzer {

    /**
     * Analyze whether there's a significant regression between two samples
     */
    static analyzeRegression(
        baselineSample: number[],
        treatmentSample: number[],
        metricName: string,
        options: StatisticalAnalysisOptions,
        outlierOptions?: OutlierRemovalOptions
    ): StatisticalComparison {

        // Remove outliers if specified
        let cleanBaseline = baselineSample;
        let cleanTreatment = treatmentSample;
        let baselineOutliers = 0;
        let treatmentOutliers = 0;

        if (outlierOptions) {
            const baselineResult = OutlierDetector.removeOutliers(baselineSample, outlierOptions);
            const treatmentResult = OutlierDetector.removeOutliers(treatmentSample, outlierOptions);

            cleanBaseline = baselineResult.cleanedValues;
            cleanTreatment = treatmentResult.cleanedValues;
            baselineOutliers = baselineResult.removedValues.length;
            treatmentOutliers = treatmentResult.removedValues.length;
        }

        // Calculate sample statistics
        const baselineStats = this.calculateSampleStatistics(
            baselineSample,
            cleanBaseline,
            baselineOutliers
        );
        const treatmentStats = this.calculateSampleStatistics(
            treatmentSample,
            cleanTreatment,
            treatmentOutliers
        );

        // Perform Mann-Whitney U test
        const mannWhitneyResult = this.mannWhitneyUTest(cleanBaseline, cleanTreatment);

        // Calculate effect size (Cohen's d)
        const effectSize = cohensD(cleanBaseline, cleanTreatment);

        // Calculate percentage and absolute changes
        const percentChange = percentageChange(baselineStats.mean, treatmentStats.mean);
        const absoluteDiff = treatmentStats.mean - baselineStats.mean;

        // Calculate confidence interval for the difference
        const confidenceInt = this.calculateDifferenceConfidenceInterval(
            cleanBaseline,
            cleanTreatment,
            options.confidenceLevel
        );

        // Determine significance
        const isStatisticallySignificant = mannWhitneyResult.pValue < options.significanceThreshold;
        const hasLargeEffect = Math.abs(effectSize) > options.effectSizeThreshold;

        // For performance metrics, regression typically means increase (worse performance)
        const isRegression = absoluteDiff > 0;
        const isImprovement = absoluteDiff < 0;

        const isSignificantRegression = isStatisticallySignificant && hasLargeEffect && isRegression;
        const isSignificantImprovement = isStatisticallySignificant && hasLargeEffect && isImprovement;

        return {
            metricName,
            baselineStats,
            treatmentStats,
            pValue: mannWhitneyResult.pValue,
            effectSize,
            percentageChange: percentChange,
            absoluteDifference: absoluteDiff,
            isSignificantRegression,
            isSignificantImprovement,
            confidenceInterval: confidenceInt
        };
    }

    /**
     * Calculate comprehensive statistics for a sample
     */
    private static calculateSampleStatistics(
        rawValues: number[],
        cleanedValues: number[],
        outliersRemoved: number
    ): SampleStatistics {
        return {
            mean: mean(cleanedValues),
            median: median(cleanedValues),
            standardDeviation: standardDeviation(cleanedValues),
            variance: variance(cleanedValues),
            min: Math.min(...cleanedValues),
            max: Math.max(...cleanedValues),
            sampleSize: cleanedValues.length,
            outliersRemoved,
            rawValues: [...rawValues],
            cleanedValues: [...cleanedValues]
        };
    }

    /**
     * Perform Mann-Whitney U test (non-parametric test for comparing two independent samples)
     */
    static mannWhitneyUTest(sample1: number[], sample2: number[]): MannWhitneyResult {
        const n1 = sample1.length;
        const n2 = sample2.length;

        if (n1 === 0 || n2 === 0) {
            return { uStatistic: 0, pValue: 1, isSignificant: false };
        }

        // Combine samples with group labels
        const combined = [
            ...sample1.map(val => ({ value: val, group: 1 })),
            ...sample2.map(val => ({ value: val, group: 2 }))
        ];

        // Sort by value
        combined.sort((a, b) => a.value - b.value);

        // Assign ranks (handle ties by averaging ranks)
        let currentRank = 1;
        for (let i = 0; i < combined.length; i++) {
            const tieStart = i;
            let tieEnd = i;

            // Find end of tie group
            while (tieEnd + 1 < combined.length &&
                combined[tieEnd + 1].value === combined[tieStart].value) {
                tieEnd++;
            }

            // Assign average rank to all tied values
            const avgRank = (currentRank + currentRank + (tieEnd - tieStart)) / 2;
            for (let j = tieStart; j <= tieEnd; j++) {
                (combined[j] as any).rank = avgRank;
            }

            currentRank += (tieEnd - tieStart + 1);
            i = tieEnd;
        }

        // Calculate rank sums
        let R1 = 0; // Rank sum for sample1
        let R2 = 0; // Rank sum for sample2

        combined.forEach(item => {
            if (item.group === 1) {
                R1 += (item as any).rank;
            } else {
                R2 += (item as any).rank;
            }
        });

        // Calculate U statistics
        const U1 = R1 - (n1 * (n1 + 1)) / 2;
        const U2 = R2 - (n2 * (n2 + 1)) / 2;
        const U = Math.min(U1, U2);

        // Calculate p-value using normal approximation for large samples
        let pValue: number;

        if (n1 < 8 || n2 < 8) {
            // For small samples, use a conservative approach
            pValue = this.exactMannWhitneyP(U, n1, n2);
        } else {
            // Normal approximation for larger samples
            const meanU = (n1 * n2) / 2;
            const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
            const z = Math.abs(U - meanU) / stdU;

            // Two-tailed p-value using normal approximation
            pValue = 2 * (1 - this.normalCDF(z));
        }

        return {
            uStatistic: U,
            pValue: Math.min(pValue, 1), // Ensure p-value doesn't exceed 1
            isSignificant: pValue < 0.05
        };
    }

    /**
     * Exact Mann-Whitney p-value for small samples (approximation)
     */
    private static exactMannWhitneyP(U: number, n1: number, n2: number): number {
        // This is a simplified approximation for small samples
        // In a production system, you'd want a more sophisticated lookup table
        const totalCombinations = this.combinations(n1 + n2, n1);
        const expectedU = (n1 * n2) / 2;

        // Simple approximation based on distance from expected value
        const deviation = Math.abs(U - expectedU) / (n1 * n2);
        return Math.max(0.01, Math.min(0.99, 2 * deviation));
    }

    /**
     * Calculate binomial coefficient (n choose k)
     */
    private static combinations(n: number, k: number): number {
        if (k > n) return 0;
        if (k === 0 || k === n) return 1;

        let result = 1;
        for (let i = 0; i < Math.min(k, n - k); i++) {
            result = result * (n - i) / (i + 1);
        }
        return Math.round(result);
    }

    /**
     * Normal cumulative distribution function approximation
     */
    private static normalCDF(z: number): number {
        // Approximation of the standard normal CDF
        const t = 1 / (1 + 0.2316419 * Math.abs(z));
        const d = 0.3989423 * Math.exp(-z * z / 2);
        let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

        if (z > 0) {
            prob = 1 - prob;
        }

        return prob;
    }

    /**
     * Calculate confidence interval for the difference between two means
     */
    private static calculateDifferenceConfidenceInterval(
        sample1: number[],
        sample2: number[],
        confidenceLevel: number
    ): [number, number] {
        const mean1 = mean(sample1);
        const mean2 = mean(sample2);
        const diff = mean2 - mean1;

        const n1 = sample1.length;
        const n2 = sample2.length;

        if (n1 <= 1 || n2 <= 1) {
            return [diff, diff];
        }

        const var1 = variance(sample1);
        const var2 = variance(sample2);

        // Standard error of the difference
        const se = Math.sqrt(var1 / n1 + var2 / n2);

        // Use t-distribution approximation (using normal for simplicity)
        const alpha = 1 - confidenceLevel;
        const zScore = confidenceLevel >= 0.95 ? 1.96 : 1.645;

        const margin = zScore * se;

        return [diff - margin, diff + margin];
    }
} 