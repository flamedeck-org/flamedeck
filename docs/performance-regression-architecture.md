# Performance Regression Testing Architecture

This document outlines the architecture of the performance regression testing framework for detecting statistically significant performance regressions in the Flamedeck application.

## Goal

To provide a robust, statistically-sound performance regression testing system that:

1. **Detects only statistically significant regressions** - avoiding false positives from normal performance variance
2. **Eliminates environment bias** - using alternating measurement patterns to account for CI environment variability
3. **Provides meaningful insights** - offering both baseline performance monitoring and regression detection
4. **Integrates seamlessly with CI/CD** - automated testing on pull requests with proper failure criteria
5. **Remains platform-agnostic** - core statistical analysis separated from specific testing frameworks

## Key Architectural Decisions & Solutions

- **Two-Package Architecture:** Core statistical analysis logic is separated into `@flamedeck/regression-core` (platform-agnostic) and `@flamedeck/regression-playwright` (Playwright-specific collectors) for maximum reusability and testability.

- **Statistical Significance Over Absolute Thresholds:** Tests only fail when statistically significant regressions are detected using Mann-Whitney U test, not when metrics cross arbitrary thresholds.

- **Alternating Measurement Pattern:** Implements base-PR-base-PR measurement cycles to eliminate systematic environment bias that could affect comparisons between base and PR branches.

- **Outlier Removal with Multiple Strategies:** Supports trim-based, IQR-based, and z-score-based outlier removal to handle performance measurement noise while preserving statistical validity.

- **Core Web Vitals Focus:** Emphasizes user-centric performance metrics (LCP, CLS, TBT) while also supporting comprehensive timing metrics.

- **Dual Test Modes:** 
  - **Baseline Mode** (informational): Collects performance metrics without failing tests
  - **Regression Mode** (CI): Compares against base branch and fails only on statistically significant regressions

## Package Architecture

### 1. `@flamedeck/regression-core`

**Location:** `packages/regression-core/`

**Purpose:** Platform-agnostic statistical analysis engine

**Key Components:**

- **Statistical Analysis (`src/statistical/`)**
  - `mannWhitneyU.ts`: Non-parametric statistical test for comparing two independent samples
  - `effectSize.ts`: Cohen's d calculation for measuring practical significance of differences
  - `outlierRemoval.ts`: Multiple strategies for removing outliers from performance measurements

- **Mathematical Utilities (`src/math/`)**
  - `mathUtils.ts`: Core mathematical functions (rank calculation, variance, standard deviation)

- **Base Comparator (`src/comparators/`)**
  - `BaseCIComparator.ts`: Abstract base class defining the interface for CI-based performance comparisons
  - Handles alternating measurement logic and statistical analysis workflow

- **Configuration (`src/types/`)**
  - Type definitions for measurement results, statistical analysis, and configuration options
  - Standardized interfaces for cross-package compatibility

**Design Principles:**
- Zero external dependencies (except TypeScript)
- Pure functions for all statistical calculations
- Comprehensive TypeScript types for type safety
- Extensive JSDoc documentation

### 2. `@flamedeck/regression-playwright`

**Location:** `packages/regression-playwright/`

**Purpose:** Playwright-specific performance data collection and CI integration

**Key Components:**

- **Performance Collectors (`src/collectors/`)**
  - `coreWebVitalsCollector.ts`: LCP, CLS, TBT collection using Performance Observer API
  - `navigationTimingCollector.ts`: Navigation timing metrics (TTFB, DOM content loaded, etc.)
  - `paintTimingCollector.ts`: First Paint and First Contentful Paint metrics
  - `resourceTimingCollector.ts`: Resource loading performance data

- **CI Comparator (`src/comparators/`)**
  - `PlaywrightCIComparator.ts`: Extends `BaseCIComparator` with Playwright-specific functionality
  - Manages base/PR URL configuration and measurement execution

- **Types and Interfaces (`src/types/`)**
  - Playwright-specific type definitions
  - Core Web Vitals interfaces
  - Performance measurement result types

**Implementation Approach:**
- Built on battle-tested approaches from Checkly's performance monitoring guide
- Uses Performance Observer API for accurate metric collection
- Implements proper waiting strategies for meaningful measurements
- Handles edge cases in performance metric collection

## Statistical Analysis Methodology

### Core Statistical Approach

1. **Mann-Whitney U Test**
   - Non-parametric test comparing two independent samples
   - No assumptions about data distribution normality
   - Robust against outliers and skewed performance data
   - Provides p-value for statistical significance determination

2. **Effect Size Calculation (Cohen's d)**
   - Measures practical significance of performance differences
   - Helps distinguish between statistically significant and practically meaningful changes
   - Categories: Small (0.2), Medium (0.5), Large (0.8) effects

3. **Outlier Removal Strategies**
   - **Trim-based:** Removes N fastest and N slowest measurements
   - **IQR-based:** Removes values outside 1.5 × IQR from quartiles
   - **Z-score-based:** Removes values with |z-score| > threshold (default: 2)

### Alternating Measurement Pattern

```
Measurement Cycle: Base → PR → Base → PR → ... (configurable iterations)
```

**Benefits:**
- Eliminates systematic bias between base and PR measurements
- Accounts for CI environment warming effects
- Reduces impact of resource contention variations
- Provides more reliable statistical comparisons

### Statistical Decision Process

1. **Collect Measurements:** Alternating base/PR measurements over N iterations
2. **Remove Outliers:** Apply configured outlier removal strategy
3. **Statistical Test:** Mann-Whitney U test on cleaned datasets
4. **Effect Size:** Calculate Cohen's d for practical significance
5. **Decision:** Fail only if p-value < α (0.05) indicating significant regression

## E2E Test Integration

### Test Structure

**Location:** `apps/client/e2e/specs/`

- `app.spec.ts`: Enhanced with baseline performance collection
- `performance-regression.spec.ts`: Dedicated regression testing suite

### Test Scenarios

**Implemented Performance Scenarios:**

1. **Homepage Performance** (`/`)
   - Landing page load time and Core Web Vitals
   - Critical user journey entry point

2. **Dashboard Performance** (`/dashboard`)
   - Authenticated user dashboard experience
   - Data-heavy page performance

3. **Upload Page Performance** (`/upload`)
   - File upload interface responsiveness
   - Form interaction performance

4. **Documentation Performance** (`/docs`)
   - Static content rendering performance
   - Documentation navigation speed

5. **Pricing Page Performance** (`/pricing`)
   - Marketing page load performance
   - Stripe integration impact

### NX Target Configuration

**Available Commands:**

```json
{
  "performance:baseline": "Informational performance metrics collection",
  "performance:regression": "CI regression detection with statistical analysis", 
  "performance:regression-quick": "Faster regression checks with fewer iterations"
}
```

## CI/CD Integration

### GitHub Actions Workflow

**Location:** `.github/workflows/performance-tests.yml`

**Architecture:**

1. **Dual Environment Setup**
   - Builds both base branch (main) and PR branch versions
   - Runs applications on separate ports (4173 for base, 4174 for PR)
   - Ensures isolated performance environments

2. **Two-Job Structure**
   
   **Main Performance Test Job:**
   - Full statistical regression analysis
   - 30-minute timeout for comprehensive testing
   - Triggers on client/package changes only
   - Uploads detailed test artifacts

   **Quick Performance Check Job:**
   - Faster baseline performance feedback
   - 15-minute timeout
   - Runs on non-draft PRs
   - Provides early performance insights

3. **Environment Variables**
   ```yaml
   PERFORMANCE_TEST: true
   BASE_URL: http://localhost:4173
   PR_URL: http://localhost:4174
   PERFORMANCE_ITERATIONS: 10
   OUTLIER_REMOVAL_COUNT: 1
   ```

4. **Failure Handling**
   - Tests fail ONLY on statistically significant regressions
   - Baseline tests run on regression failure for additional context
   - Comprehensive artifact collection for debugging

### Path-Based Triggering

```yaml
paths:
  - 'apps/client/**'
  - 'packages/**'
  - 'package.json'
  - 'yarn.lock'
```

**Benefits:**
- Conserves CI resources by running only when performance might be affected
- Reduces unnecessary test execution on documentation or configuration changes
- Maintains rapid feedback loops for relevant changes

## Configuration System

### Core Configuration

**Environment Variables:**
- `PERFORMANCE_TEST`: Enables CI regression testing mode
- `BASE_URL` / `PR_URL`: Target URLs for comparison testing
- `PERFORMANCE_ITERATIONS`: Number of measurement cycles (default: 10)
- `OUTLIER_REMOVAL_COUNT`: Number of outliers to remove (default: 1)

**Statistical Configuration:**
- Significance level (α): 0.05 (95% confidence)
- Effect size calculation: Cohen's d
- Outlier removal: Configurable strategy selection

### Test-Specific Configuration

**Playwright Configuration:**
```typescript
// Each test scenario can be configured independently
const performanceConfig = {
  waitForNetworkIdle: true,
  measurementDelay: 2000,
  iterations: process.env.PERFORMANCE_ITERATIONS || 10
};
```

## Data Flow Examples

### Baseline Performance Collection

1. **Test Execution:** E2E test navigates to target page
2. **Metric Collection:** Core Web Vitals and timing metrics gathered
3. **Aggregation:** Statistics calculated (mean, median, percentiles)
4. **Reporting:** Results logged for monitoring (no test failure)

### Regression Detection Flow

1. **Environment Setup:** 
   - Base branch app running on port 4173
   - PR branch app running on port 4174

2. **Alternating Measurements:**
   ```
   Iteration 1: Base URL → Collect metrics
   Iteration 1: PR URL → Collect metrics
   Iteration 2: Base URL → Collect metrics
   Iteration 2: PR URL → Collect metrics
   ... (continue for N iterations)
   ```

3. **Statistical Analysis:**
   - Separate base and PR measurements into datasets
   - Apply outlier removal strategy
   - Execute Mann-Whitney U test
   - Calculate Cohen's d effect size

4. **Decision Making:**
   ```typescript
   if (pValue < 0.05 && prMedian > baseMedian) {
     // Statistically significant regression detected
     throw new Error(`Performance regression detected: ${metricName}`);
   }
   ```

5. **Reporting:**
   - Detailed statistical results in test artifacts
   - GitHub Actions annotations for failures
   - Performance comparison summaries

## Key Benefits

### For Developers
- **Confidence in Performance Changes:** Only fails on real regressions, not noise
- **Early Detection:** Catches performance issues before they reach production
- **Detailed Insights:** Comprehensive performance data for debugging

### For CI/CD Pipeline
- **Reliable Automation:** Statistically sound pass/fail criteria
- **Resource Efficiency:** Smart path-based triggering
- **Actionable Results:** Clear distinction between noise and real regressions

### For Performance Monitoring
- **Baseline Tracking:** Continuous performance monitoring without test failures
- **Trend Analysis:** Historical performance data collection
- **User-Centric Metrics:** Focus on Core Web Vitals that impact user experience

## Future Extensibility

The architecture supports easy extension for:

- **Additional Performance Metrics:** New collectors can be added to the Playwright package
- **Different Testing Frameworks:** New packages can extend the core statistical engine
- **Enhanced Statistical Methods:** Core package can be extended with additional tests
- **Custom Scenarios:** Application-specific performance testing scenarios
- **Integration Platforms:** Core logic can be adapted for different CI/CD systems

This modular approach ensures the framework can evolve with changing performance testing needs while maintaining statistical rigor and reliability. 