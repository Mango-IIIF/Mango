import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  /*
   * Every spec here drives a real viewer against live IIIF endpoints, so the
   * budget has to cover network as well as layout. A CI runner is several times
   * slower than a dev machine — full runs take ~5 minutes there against ~50s
   * locally — and the failures seen there burn the whole per-test budget on
   * navigation rather than failing an assertion. Give CI room; keep the local
   * budget tight so genuinely stuck tests still surface quickly.
   */
  timeout: process.env.CI ? 90_000 : 45_000,
  expect: {
    timeout: 15_000,
  },
  /*
   * These specs drive a real viewer against live IIIF image services, so a
   * handful of them are timing-sensitive: on a slow, loaded CI runner a viewport
   * can still be settling when an assertion samples it. That flakiness predates
   * any one change — an unmodified checkout fails roughly one full run in three
   * here — so retry on CI rather than reading every red run as a regression. A
   * genuinely broken test still fails every attempt.
   */
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 1000 },
      },
    },
    ...(process.env.CI
      ? [
          {
            name: 'mobile-webkit',
            grep: /handheld viewer layout|responsive mode matrix|iPad fullscreen and story rail|embedded height and hostile host CSS|phone metadata expansion|iPhone SE touch rails|priority mobile interactions/,
            use: {
              ...devices['iPhone 13'],
            },
          },
        ]
      : []),
  ],
  webServer: {
    command:
      'npm run build:demo && npx vite --config vite.config.demo.ts --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/annotation-editor-wellcome.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
