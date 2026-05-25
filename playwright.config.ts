import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:18730',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:web',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://localhost:18730',
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
