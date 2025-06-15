import { defineConfig, devices } from '@playwright/test';

// Determine if we're in CI or running performance tests
const isCI = !!process.env.CI;
const isPerformanceTest = !!process.env.PERFORMANCE_TEST;

// Configure base URL and webServer based on environment
const getWebServerConfig = () => {
  // If performance testing with external servers (either CI or local with BASE_URL/PR_URL set)
  if (isPerformanceTest || process.env.BASE_URL || process.env.PR_URL) {
    console.log('[PLAYWRIGHT CONFIG] Using external servers for performance testing');
    return {
      baseURL: process.env.BASE_URL || 'http://localhost:4173', // Use provided URL or default to preview port
      webServer: undefined, // Don't start our own server - external servers are running
    };
  }

  // If we're in CI but not performance testing, assume external server is running
  if (isCI) {
    console.log('[PLAYWRIGHT CONFIG] Using external server for CI');
    return {
      baseURL: 'http://localhost:4173', // Preview server port
      webServer: undefined, // Don't start our own server
    };
  }

  // Local development - start dev server
  console.log('[PLAYWRIGHT CONFIG] Starting local dev server');
  return {
    baseURL: 'http://localhost:8080',
    webServer: {
      command: 'yarn nx run client:dev',
      url: 'http://localhost:8080',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2 minutes timeout
    },
  };
};

const { baseURL, webServer } = getWebServerConfig();

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e/specs',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html', { outputFolder: 'e2e/reports' }], ['list']],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot only when test fails */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    /* Other browsers commented out for now - uncomment to test against multiple browsers */
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer,
});
