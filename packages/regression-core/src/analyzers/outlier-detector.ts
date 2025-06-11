import { OutlierRemovalOptions } from '../types/statistics';
import { mean, standardDeviation, interquartileRange, zScore } from '../utils/math';

/**
 * Outlier detection and removal functionality
 */
export class OutlierDetector {
    /**
     * Remove outliers from a dataset using the specified method
     */
    static removeOutliers(values: number[], options: OutlierRemovalOptions): {
        cleanedValues: number[];
        removedValues: number[];
        removalIndices: number[];
    } {
        switch (options.method) {
            case 'trim':
                return this.trimOutliers(values, options.removeCount);
            case 'iqr':
                return this.removeIQROutliers(values);
            case 'zscore':
                return this.removeZScoreOutliers(values, options.zScoreThreshold || 2.5);
            default:
                throw new Error(`Unknown outlier removal method: ${options.method}`);
        }
    }

    /**
     * Remove N highest and N lowest values (trim method)
     */
    private static trimOutliers(values: number[], removeCount: number): {
        cleanedValues: number[];
        removedValues: number[];
        removalIndices: number[];
    } {
        if (removeCount <= 0 || values.length <= removeCount * 2) {
            return {
                cleanedValues: [...values],
                removedValues: [],
                removalIndices: []
            };
        }

        // Create array of indices with values for tracking
        const indexedValues = values.map((value, index) => ({ value, index }));

        // Sort by value
        indexedValues.sort((a, b) => a.value - b.value);

        // Remove N from each end
        const removed = [
            ...indexedValues.slice(0, removeCount),
            ...indexedValues.slice(-removeCount)
        ];

        const cleaned = indexedValues.slice(removeCount, -removeCount);

        return {
            cleanedValues: cleaned.map(item => item.value),
            removedValues: removed.map(item => item.value),
            removalIndices: removed.map(item => item.index)
        };
    }

    /**
     * Remove outliers using Interquartile Range (IQR) method
     */
    private static removeIQROutliers(values: number[]): {
        cleanedValues: number[];
        removedValues: number[];
        removalIndices: number[];
    } {
        const { q1, q3, iqr } = interquartileRange(values);
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        const cleaned: number[] = [];
        const removed: number[] = [];
        const removalIndices: number[] = [];

        values.forEach((value, index) => {
            if (value < lowerBound || value > upperBound) {
                removed.push(value);
                removalIndices.push(index);
            } else {
                cleaned.push(value);
            }
        });

        return { cleanedValues: cleaned, removedValues: removed, removalIndices };
    }

    /**
     * Remove outliers using Z-score method
     */
    private static removeZScoreOutliers(values: number[], threshold: number): {
        cleanedValues: number[];
        removedValues: number[];
        removalIndices: number[];
    } {
        const cleaned: number[] = [];
        const removed: number[] = [];
        const removalIndices: number[] = [];

        values.forEach((value, index) => {
            const z = Math.abs(zScore(value, values));

            if (z > threshold) {
                removed.push(value);
                removalIndices.push(index);
            } else {
                cleaned.push(value);
            }
        });

        return { cleanedValues: cleaned, removedValues: removed, removalIndices };
    }

    /**
     * Identify outliers without removing them
     */
    static identifyOutliers(values: number[], method: 'iqr' | 'zscore' = 'iqr', threshold?: number): {
        outlierIndices: number[];
        outlierValues: number[];
        isOutlier: boolean[];
    } {
        let outlierIndices: number[];

        switch (method) {
            case 'iqr':
                const result = this.removeIQROutliers(values);
                outlierIndices = result.removalIndices;
                break;
            case 'zscore':
                const zResult = this.removeZScoreOutliers(values, threshold || 2.5);
                outlierIndices = zResult.removalIndices;
                break;
            default:
                throw new Error(`Unknown outlier detection method: ${method}`);
        }

        const isOutlier = values.map((_, index) => outlierIndices.includes(index));
        const outlierValues = outlierIndices.map(index => values[index]);

        return { outlierIndices, outlierValues, isOutlier };
    }

    /**
     * Get outlier statistics for a dataset
     */
    static getOutlierStatistics(values: number[]): {
        iqrOutliers: number;
        zScoreOutliers: number;
        percentageIQR: number;
        percentageZScore: number;
    } {
        const iqrResult = this.identifyOutliers(values, 'iqr');
        const zScoreResult = this.identifyOutliers(values, 'zscore');

        return {
            iqrOutliers: iqrResult.outlierIndices.length,
            zScoreOutliers: zScoreResult.outlierIndices.length,
            percentageIQR: (iqrResult.outlierIndices.length / values.length) * 100,
            percentageZScore: (zScoreResult.outlierIndices.length / values.length) * 100
        };
    }
} 