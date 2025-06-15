/**
 * Base interface for any collection of metrics
 */
export interface MetricCollection {
  [metricName: string]: number;
}

/**
 * A single measurement point with metadata
 */
export interface MeasurementPoint<T extends MetricCollection = MetricCollection> {
  timestamp: Date;
  metrics: T;
  metadata?: Record<string, any>;
}

/**
 * Collection of measurements for a specific variant (base/treatment)
 */
export interface MeasurementSeries<T extends MetricCollection = MetricCollection> {
  variant: 'base' | 'treatment';
  measurements: MeasurementPoint<T>[];
}

/**
 * Configuration for a comparison test
 */
export interface ComparisonConfig<T extends MetricCollection = MetricCollection> {
  /** Number of measurements to take for each variant */
  iterations: number;
  /** Number of outliers to remove from each sample (removes N highest and N lowest) */
  outlierRemovalCount: number;
  /** P-value threshold for statistical significance */
  significanceThreshold: number;
  /** Effect size threshold (Cohen's d) */
  effectSizeThreshold: number;
  /** Test scenarios to run */
  scenarios: TestScenario<T>[];
}

/**
 * A test scenario definition
 */
export interface TestScenario<T extends MetricCollection = MetricCollection> {
  name: string;
  description?: string;
  /** Custom logic for executing this scenario */
  execute?: (variant: 'base' | 'treatment') => Promise<T>;
}

/**
 * Raw comparison input data
 */
export interface ComparisonInput<T extends MetricCollection = MetricCollection> {
  baseMeasurements: MeasurementPoint<T>[];
  treatmentMeasurements: MeasurementPoint<T>[];
  config: ComparisonConfig<T>;
}
