# End-to-End Tests

This directory contains Playwright end-to-end tests for the Flamedeck client application.

## Running Tests

Use the following NX commands to run the e2e tests:

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

## Test Structure

- `specs/` - Contains all test files
- `fixtures/` - Contains test data and utilities
- `reports/` - Generated test reports (ignored by git)

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

## Debugging

1. Use `yarn nx run client:e2e:debug` to step through tests
2. Add `await page.pause()` in your test to pause execution
3. Use `await page.screenshot({ path: 'debug.png' })` to capture screenshots
4. Check the HTML report in `e2e/reports/` after test runs 