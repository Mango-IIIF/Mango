import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'apps/demo/tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command:
      'npm run --workspace @mango/iiif-viewer-demo dev -- --host --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
