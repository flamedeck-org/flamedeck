/**
 * Mathematical utility functions for statistical analysis
 */

/**
 * Calculate the mean of an array of numbers
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate the median of an array of numbers
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Calculate the standard deviation of an array of numbers
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const avg = mean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
  const avgSquaredDiff = mean(squaredDiffs);

  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate the variance of an array of numbers
 */
export function variance(values: number[]): number {
  const std = standardDeviation(values);
  return std * std;
}

/**
 * Calculate the pooled standard deviation for two samples
 */
export function pooledStandardDeviation(sample1: number[], sample2: number[]): number {
  const n1 = sample1.length;
  const n2 = sample2.length;

  if (n1 <= 1 || n2 <= 1) return 0;

  const var1 = variance(sample1);
  const var2 = variance(sample2);

  const pooledVariance = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);

  return Math.sqrt(pooledVariance);
}

/**
 * Calculate Cohen's d effect size
 */
export function cohensD(sample1: number[], sample2: number[]): number {
  const mean1 = mean(sample1);
  const mean2 = mean(sample2);
  const pooledStd = pooledStandardDeviation(sample1, sample2);

  if (pooledStd === 0) return 0;

  return (mean2 - mean1) / pooledStd;
}

/**
 * Calculate the z-score for a value in a dataset
 */
export function zScore(value: number, dataset: number[]): number {
  const avg = mean(dataset);
  const std = standardDeviation(dataset);

  if (std === 0) return 0;

  return (value - avg) / std;
}

/**
 * Calculate the interquartile range (IQR)
 */
export function interquartileRange(values: number[]): { q1: number; q3: number; iqr: number } {
  if (values.length === 0) return { q1: 0, q3: 0, iqr: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];

  return { q1, q3, iqr: q3 - q1 };
}

/**
 * Calculate percentile for a given value
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (p < 0 || p > 100) throw new Error('Percentile must be between 0 and 100');

  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);

  if (Number.isInteger(index)) {
    return sorted[index];
  } else {
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}

/**
 * Calculate confidence interval for the mean
 */
export function confidenceInterval(
  values: number[],
  confidenceLevel: number = 0.95
): [number, number] {
  if (values.length === 0) return [0, 0];

  const n = values.length;
  const avg = mean(values);
  const std = standardDeviation(values);
  const standardError = std / Math.sqrt(n);

  // For simplicity, using normal approximation (z-score)
  // For small samples, t-distribution would be more appropriate
  const alpha = 1 - confidenceLevel;
  const zScore = getZScore(1 - alpha / 2);

  const margin = zScore * standardError;

  return [avg - margin, avg + margin];
}

/**
 * Get z-score for a given probability (inverse normal CDF approximation)
 */
function getZScore(p: number): number {
  // Approximation of inverse normal CDF for common confidence levels
  if (p >= 0.975) return 1.96; // 95% confidence
  if (p >= 0.995) return 2.576; // 99% confidence
  if (p >= 0.9) return 1.645; // 90% confidence

  // For other values, use a simple approximation
  return Math.sqrt(-2 * Math.log(1 - p));
}

/**
 * Calculate percentage change between two values
 */
export function percentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue === 0 ? 0 : Infinity;
  }

  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}
