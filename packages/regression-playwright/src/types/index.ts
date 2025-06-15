// Playwright-specific metric types
export type {
  CoreWebVitals,
  NavigationMetrics,
  PaintMetrics,
  ResourceMetrics,
  LongTaskMetrics,
  PlaywrightMetrics,
  BrowserContext,
  PageLoadContext,
  PlaywrightMeasurementPoint,
} from './playwright-metrics';

// Scenario and configuration types
export type { PlaywrightTestScenario, PlaywrightComparisonConfig } from './scenarios';

export { CommonScenarios, DevicePresets, NetworkPresets } from './scenarios';
