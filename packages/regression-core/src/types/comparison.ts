import type { MetricCollection } from './metrics';
import type { StatisticalComparison, RegressionAssessment } from './statistics';

/**
 * Results for a single scenario comparison
 */
export interface ScenarioComparisonResult<T extends MetricCollection = MetricCollection> {
  scenarioName: string;
  description?: string;
  /** Statistical comparison for each metric */
  metricComparisons: StatisticalComparison[];
  /** Overall assessment for this scenario */
  assessment: RegressionAssessment;
  /** Execution metadata */
  executionTime: number;
  timestamp: Date;
}

/**
 * Complete comparison results for all scenarios
 */
export interface ComparisonResult<T extends MetricCollection = MetricCollection> {
  /** Summary statistics */
  summary: ComparisonSummary;
  /** Results for each scenario */
  scenarios: ScenarioComparisonResult<T>[];
  /** Overall assessment across all scenarios */
  overallAssessment: RegressionAssessment;
  /** Configuration used for this comparison */
  config: any; // We'll keep this generic to avoid circular imports
  /** When the comparison was executed */
  timestamp: Date;
  /** Total execution time in milliseconds */
  totalExecutionTime: number;
}

/**
 * High-level summary of comparison results
 */
export interface ComparisonSummary {
  totalScenarios: number;
  totalMetrics: number;
  significantRegressions: number;
  significantImprovements: number;
  neutralChanges: number;
  /** Percentage of metrics that showed regression */
  regressionRate: number;
  /** Percentage of metrics that showed improvement */
  improvementRate: number;
  /** Most impacted metrics across all scenarios */
  mostImpactedMetrics: MetricImpact[];
}

/**
 * Impact assessment for a specific metric
 */
export interface MetricImpact {
  metricName: string;
  /** Number of scenarios where this metric regressed */
  regressionCount: number;
  /** Number of scenarios where this metric improved */
  improvementCount: number;
  /** Average effect size across scenarios */
  averageEffectSize: number;
  /** Maximum effect size observed */
  maxEffectSize: number;
  /** Severity assessment */
  severity: 'low' | 'medium' | 'high';
}

/**
 * Report generation options
 */
export interface ReportOptions {
  includeRawData: boolean;
  includeConfidenceIntervals: boolean;
  includePlots: boolean;
  format: 'json' | 'markdown' | 'html';
  outputPath?: string;
}

/**
 * Formatted report for consumption by CI/reporting systems
 */
export interface FormattedReport {
  format: 'json' | 'markdown' | 'html';
  content: string;
  summary: string;
  /** Whether this report indicates a failure condition */
  shouldFail: boolean;
  /** Structured data for programmatic consumption */
  data: ComparisonResult;
}
