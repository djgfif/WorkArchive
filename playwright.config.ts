import { defineConfig, devices } from '@playwright/test';

const webPort = process.env.WEB_E2E_PORT ?? '18730';
const webBaseUrl = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: './apps/web/e2e',
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: webBaseUrl,
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      webPort === '18730'
        ? 'npm run dev:web'
        : `npm run dev --workspace @work-archive/web -- --host 127.0.0.1 --port ${webPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: webBaseUrl,
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
