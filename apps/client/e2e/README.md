# End-to-End Testing & Performance Regression Framework

This directory contains a comprehensive testing framework for Flamedeck that includes both functional E2E tests and statistical performance regression testing.

## Quick Start

### Basic E2E Testing
```bash
# Run all E2E tests
yarn nx e2e client

# Run with UI for debugging
yarn nx e2e:ui client

# Run in headed mode (see browser)
yarn nx e2e:headed client
```

### Performance Testing

#### Collect Performance Baseline (Development)
```bash
# Collect current performance metrics (informational only)
yarn nx performance:baseline client
```

#### Local Performance Regression Testing
```bash
# Compare current branch against main
yarn nx performance:compare client

# Quick comparison (fewer scenarios & iterations)
yarn nx performance:compare-quick client

# Compare against a specific branch
yarn nx performance:compare-vs-develop client

# Manual script usage
node e2e/scripts/run-performance-regression.cjs --help
```

#### CI Performance Testing
```bash
# Used in GitHub Actions
yarn nx performance:ci client
```

## Performance Regression Framework

### Overview

The performance regression framework provides statistically rigorous performance testing that:

- **Only fails on statistically significant regressions** (not absolute thresholds)
- **Eliminates environmental noise** through alternating measurements
- **Uses statistical tests** (Mann-Whitney U) to detect real performance changes
- **Handles outliers** automatically through multiple detection methods
- **Provides confidence intervals** and effect sizes for meaningful interpretation

### Architecture

The framework consists of two main packages:

- **`@flamedeck/regression-core`**: Platform-agnostic statistical engine
- **`@flamedeck/regression-playwright`**: Playwright-specific performance collectors

### Key Features

#### Statistical Rigor
- Mann-Whitney U test for non-parametric comparison
- Multiple outlier detection methods (trim, IQR, z-score)
- Cohen's d effect size calculation
- 95% confidence intervals
- Configurable significance levels

#### Performance Metrics
- **Core Web Vitals**: LCP, CLS, TBT
- **Navigation Timing**: TTFB, DNS, TCP, DOM events
- **Paint Timing**: First Paint, First Contentful Paint
- **Resource Timing**: Load times, sizes, resource counts

#### Testing Modes

1. **Local Mode**: Compare current branch against any base branch/commit
2. **CI Mode**: Statistical comparison between base and PR builds
3. **Baseline Mode**: Collect metrics for visibility (never fails)

### Local Testing Workflow

The local performance testing automatically:

1. **Stashes uncommitted changes** (if any)
2. **Builds the base version** (e.g., main branch)
3. **Builds the current version** (your working branch)
4. **Runs alternating measurements** for fair comparison
5. **Performs statistical analysis** using the regression framework
6. **Reports only statistically significant regressions**
7. **Restores your working state**

Example output:
```bash
🚀 Starting Performance Regression Testing
📊 Configuration:
   Base: main
   Iterations: 5
   Scenarios: homepage, dashboard
   Mode: Local

🔄 Switching to base: main
📦 Installing dependencies for base...
🏗️ Building base version...
🔄 Switching back to current version...
📦 Installing dependencies for current...
🏗️ Building current version...
⚡ Running performance regression tests...

📊 Results for homepage:
  LCP: +2.3% (p=0.234) ✅ OK
  CLS: -15.2% (p=0.012) ✅ IMPROVEMENT
  TBT: +45.8% (p=0.003) 🔴 REGRESSION

❌ Performance regression detected! 1 metrics regressed: TBT
```

### CI Integration

The framework integrates seamlessly with GitHub Actions:

```yaml
- name: Performance Regression Test
  run: |
    # Build base and PR versions
    yarn nx build client # Base version
    yarn nx build client # PR version
    
    # Run statistical comparison
    BASE_URL=${{ base_url }} PR_URL=${{ pr_url }} yarn nx performance:ci client
```

See `github-actions-example.yml` for a complete CI workflow.

### Configuration

#### Performance Scenarios

Scenarios are defined in `performance-scenarios.ts`:

```typescript
export const PERFORMANCE_SCENARIOS = [
  {
    name: 'homepage',
    url: 'http://localhost:3000',
    waitFor: async (page) => {
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="hero-section"]');
    }
  },
  // ... more scenarios
];
```

#### Framework Configuration

```typescript
export const flamedeckPerformanceConfig = {
  iterations: 10,                    // Measurements per branch
  outlierMethod: 'trim' as const,    // Outlier detection method
  outlierThreshold: 0.1,             // Remove 10% outliers
  significanceLevel: 0.05,           // 5% significance level
  browser: 'chromium' as const,
  outlierRemovalCount: 1             // Remove 1 outlier per tail
};
```

### Understanding Results

#### Statistical Significance
- **p-value < 0.05**: Statistically significant change
- **p-value ≥ 0.05**: No significant change (noise)

#### Effect Size (Cohen's d)
- **< 0.2**: Small effect
- **0.2-0.5**: Medium effect  
- **> 0.5**: Large effect

#### Confidence Intervals
- **95% CI [lower, upper]**: Range where true difference likely lies
- **Excludes 0**: Significant change
- **Includes 0**: No significant change

### Troubleshooting

#### Common Issues

1. **Build failures**: Ensure both base and current branches build successfully
2. **Test timeouts**: Increase timeout in playwright.config.ts
3. **Port conflicts**: The framework uses ports 3001-3002 for local testing
4. **Git repository required**: Local testing requires a git repository

#### Debug Mode

```bash
# Run with Playwright debug mode
yarn nx e2e:debug client

# Verbose script output
node e2e/scripts/run-performance-regression.js --help
```

### Advanced Usage

#### Custom Scenarios
```bash
# Test specific scenarios
node e2e/scripts/run-performance-regression.cjs --scenarios homepage,dashboard
```

#### Custom Iterations
```bash
# More iterations for higher confidence
node e2e/scripts/run-performance-regression.cjs --iterations 15
```

#### Different Base Branch
```bash
# Compare against develop instead of main
node e2e/scripts/run-performance-regression.cjs --base develop
```

## Files Structure

```
e2e/
├── scripts/
│   └── run-performance-regression.cjs    # Main orchestration script
├── specs/
│   ├── app.spec.ts                     # Basic E2E tests
│   └── performance-regression.spec.ts  # Performance tests
├── fixtures/                           # Test fixtures
├── reports/                           # Test reports
├── results/                           # Performance results
├── performance-scenarios.ts           # Test scenarios definition
├── playwright.config.ts              # Playwright configuration
├── github-actions-example.yml        # CI workflow example
└── README.md                         # This file
```

## Development Guidelines

### Adding New Scenarios

1. Add scenario to `performance-scenarios.ts`
2. Include proper wait conditions
3. Test locally before CI

### Modifying Thresholds

- **Avoid absolute thresholds** - use statistical significance instead
- **Adjust significance level** in configuration if needed
- **Consider effect size** for practical significance

### Best Practices

1. **Test locally first** before creating PRs
2. **Use quick mode** for rapid iteration
3. **Check baseline metrics** regularly
4. **Monitor CI performance** over time
5. **Don't ignore statistical warnings**

For more details on the statistical framework, see the `packages/regression-core` documentation. 