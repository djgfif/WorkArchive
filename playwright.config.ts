import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:53173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:web',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:53173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
