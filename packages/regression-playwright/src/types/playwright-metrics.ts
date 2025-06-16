import type { MetricCollection } from '@flamedeck/regression-core';

/**
 * Core Web Vitals metrics collected via Playwright
 */
export interface CoreWebVitals {
  /** Largest Contentful Paint (ms) */
  lcp: number;
  /** Cumulative Layout Shift (unitless score) */
  cls: number;
  /** Total Blocking Time (ms) - lab equivalent of FID */
  tbt: number;
}

/**
 * Navigation timing metrics from Performance API
 */
export interface NavigationMetrics {
  /** Time to First Byte (ms) */
  ttfb: number;
  /** DNS lookup time (ms) */
  dnsLookup: number;
  /** TCP connection time (ms) */
  tcpConnection: number;
  /** Request/response time (ms) */
  requestResponse: number;
  /** DOM interactive time (ms) */
  domInteractive: number;
  /** DOM content loaded time (ms) */
  domContentLoaded: number;
  /** Load event time (ms) */
  loadEvent: number;
  /** Total page load time (ms) */
  totalLoadTime: number;
}

/**
 * Paint timing metrics
 */
export interface PaintMetrics {
  /** First Paint (ms) */
  fp: number;
  /** First Contentful Paint (ms) */
  fcp: number;
}

/**
 * Resource timing summary metrics
 */
export interface ResourceMetrics {
  /** Number of resources loaded */
  resourceCount: number;
  /** Total resource size (bytes) */
  totalResourceSize: number;
  /** Average resource load time (ms) */
  averageResourceLoadTime: number;
  /** Largest resource size (bytes) */
  largestResourceSize: number;
  /** Slowest resource load time (ms) */
  slowestResourceLoadTime: number;
}

/**
 * Long task metrics for Total Blocking Time calculation
 */
export interface LongTaskMetrics {
  /** Number of long tasks (> 50ms) */
  longTaskCount: number;
  /** Total blocking time (ms) */
  totalBlockingTime: number;
  /** Longest task duration (ms) */
  longestTaskDuration: number;
}

/**
 * Complete Playwright performance metrics
 */
export interface PlaywrightMetrics extends MetricCollection {
  // Core Web Vitals
  lcp: number;
  cls: number;
  tbt: number;

  // Navigation timing
  ttfb: number;
  dnsLookup: number;
  tcpConnection: number;
  requestResponse: number;
  domInteractive: number;
  domContentLoaded: number;
  loadEvent: number;
  totalLoadTime: number;

  // Paint timing
  fp: number;
  fcp: number;

  // Resource metrics
  resourceCount: number;
  totalResourceSize: number;
  averageResourceLoadTime: number;
  largestResourceSize: number;
  slowestResourceLoadTime: number;

  // Long task metrics
  longTaskCount: number;
  longestTaskDuration: number;
}

/**
 * Browser and environment context for measurements
 */
export interface BrowserContext {
  browserName: string;
  browserVersion: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  deviceScaleFactor: number;
  isMobile: boolean;
}

/**
 * Page load context and conditions
 */
export interface PageLoadContext {
  url: string;
  timestamp: Date;
  cacheEnabled: boolean;
  networkConditions?: {
    offline: boolean;
    downloadThroughput: number;
    uploadThroughput: number;
    latency: number;
  };
  cpuThrottling?: {
    rate: number;
  };
}

/**
 * Extended measurement point with Playwright-specific context
 */
export interface PlaywrightMeasurementPoint {
  timestamp: Date;
  metrics: PlaywrightMetrics;
  browserContext: BrowserContext;
  pageLoadContext: PageLoadContext;
  errors?: string[];
  warnings?: string[];
}
