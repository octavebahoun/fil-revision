import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const isRemote = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    video: process.env.E2E_VIDEO ? "on" : "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    ...(process.env.E2E_ALL_DEVICES ? [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }] : []),
  ],
  webServer: isRemote
    ? undefined
    : {
        command: process.env.E2E_PROD_BUILD
          ? `tsx scripts/with-env.ts .env.test.local -- next start -p ${PORT}`
          : `tsx scripts/with-env.ts .env.test.local -- next dev -p ${PORT}`,
        url: `${BASE_URL}/connexion`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        // La limitation de débit est testée en intégration ; en E2E, toutes les connexions viennent de la même IP.
        env: { NEXT_PUBLIC_SITE_URL: BASE_URL, RATE_LIMIT_DISABLED: "1" },
      },
});
