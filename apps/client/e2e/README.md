# End-to-End Tests

This directory contains Playwright end-to-end tests for the Flamedeck client application, including performance regression testing.

## Running Tests

### Basic E2E Tests

```bash
# Run all e2e tests (headless)
yarn nx run client:e2e

# Run tests with UI mode (interactive)
yarn nx run client:e2e:ui

# Run tests in headed mode (visible browser)
yarn nx run client:e2e:headed

# Run tests in debug mode (step through)
yarn nx run client:e2e:debug
```

### Performance Tests

```bash
# Run performance baseline tests (informational - won't fail on thresholds)
yarn nx run client:performance:baseline

# Run performance regression tests (ONLY FAILS on statistically significant regressions vs base)
BASE_URL=http://localhost:4173 PR_URL=http://localhost:4174 yarn nx run client:performance:regression

# Quick performance regression test (fewer scenarios)
BASE_URL=http://localhost:4173 PR_URL=http://localhost:4174 yarn nx run client:performance:regression-quick
```

## Test Structure

- `specs/` - Contains all test files
  - `app.spec.ts` - Basic functional tests + performance benchmarks
  - `performance-regression.spec.ts` - Performance comparison tests for CI
- `fixtures/` - Contains test data and utilities
- `reports/` - Generated test reports (ignored by git)
- `performance-scenarios.ts` - Flamedeck-specific performance test scenarios

## Writing Tests

Tests are written using Playwright's test runner. Here's a basic example:

```typescript
import { test, expect } from '@playwright/test';

test('should do something', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
```

## Configuration

The Playwright configuration is in `playwright.config.ts` in the client app root. Key settings:

- **Base URL**: `http://localhost:8080`
- **Test Directory**: `./e2e/specs`
- **Browsers**: Chrome, Firefox, Safari
- **Web Server**: Automatically starts the dev server before running tests

## Performance Testing

The performance testing framework measures Core Web Vitals and other performance metrics:

### Metrics Collected
- **Core Web Vitals**: LCP, CLS, TBT
- **Navigation Timing**: TTFB, DNS lookup, TCP connection
- **Paint Timing**: First Paint, First Contentful Paint
- **Resource Metrics**: Load times, sizes, counts

### Performance Regression Testing
The framework compares performance between base and PR branches using:
- Statistical analysis (Mann-Whitney U test)
- Outlier removal for noise reduction  
- Effect size calculation (Cohen's d)
- Alternating measurements for fair comparison

**Important**: Tests only fail on statistically significant regressions, not absolute performance thresholds. This means:
- ✅ Baseline tests collect metrics for visibility but never fail
- ⚠️ Regression tests only fail when your PR makes performance significantly worse than master
- 📊 All performance data is logged for debugging and monitoring

### CI Integration
See `github-actions-example.yml` for a complete CI workflow that:
1. Builds both base and PR branches
2. Runs alternating performance measurements
3. Reports regressions with statistical confidence
4. Generates GitHub Actions summaries

## Debugging

1. Use `yarn nx run client:e2e:debug` to step through tests
2. Add `await page.pause()` in your test to pause execution
3. Use `await page.screenshot({ path: 'debug.png' })` to capture screenshots
4. Check the HTML report in `e2e/reports/` after test runs
5. For performance debugging, check console output for detailed metrics 