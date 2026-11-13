const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/playwright',
  timeout: 45000,
  expect: { timeout: 12000 },
  retries: 1,
  workers: 1,
  use: { browserName: 'chromium', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure', navigationTimeout: 30000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
});
