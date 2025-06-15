/**
 * Statistical summary of a sample
 */
export interface SampleStatistics {
  mean: number;
  median: number;
  standardDeviation: number;
  variance: number;
  min: number;
  max: number;
  sampleSize: number;
  outliersRemoved: number;
  rawValues: number[];
  cleanedValues: number[];
}

/**
 * Result of statistical comparison between two samples
 */
export interface StatisticalComparison {
  metricName: string;
  baselineStats: SampleStatistics;
  treatmentStats: SampleStatistics;
  /** P-value from statistical test (Mann-Whitney U) */
  pValue: number;
  /** Effect size (Cohen's d) */
  effectSize: number;
  /** Percentage change from baseline to treatment */
  percentageChange: number;
  /** Absolute difference from baseline to treatment */
  absoluteDifference: number;
  /** Whether this represents a statistically significant regression */
  isSignificantRegression: boolean;
  /** Whether this represents a statistically significant improvement */
  isSignificantImprovement: boolean;
  /** 95% confidence interval for the difference */
  confidenceInterval: [number, number];
}

/**
 * Options for statistical analysis
 */
export interface StatisticalAnalysisOptions {
  /** P-value threshold for significance */
  significanceThreshold: number;
  /** Effect size threshold (Cohen's d) */
  effectSizeThreshold: number;
  /** Confidence level for interval estimation */
  confidenceLevel: number;
}

/**
 * Options for outlier removal
 */
export interface OutlierRemovalOptions {
  /** Number of outliers to remove from each tail */
  removeCount: number;
  /** Method for outlier detection */
  method: 'trim' | 'iqr' | 'zscore';
  /** Threshold for z-score method */
  zScoreThreshold?: number;
}

/**
 * Result of Mann-Whitney U test
 */
export interface MannWhitneyResult {
  uStatistic: number;
  pValue: number;
  /** Whether sample1 is significantly different from sample2 */
  isSignificant: boolean;
}

/**
 * Regression analysis severity levels
 */
export type RegressionSeverity = 'none' | 'minor' | 'moderate' | 'severe';

/**
 * Overall regression assessment
 */
export interface RegressionAssessment {
  severity: RegressionSeverity;
  confidence: number;
  affectedMetrics: string[];
  summary: string;
}
