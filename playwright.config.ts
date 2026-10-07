import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH === ""
          ? undefined
          : process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "mkdir -p /tmp/tableq-e2e && rm -f /tmp/tableq-e2e/tableq.sqlite* && NODE_ENV=production DATABASE_PATH=/tmp/tableq-e2e/tableq.sqlite APP_URL=http://localhost:3100 ADMIN_EMAIL=manager@example.test ADMIN_PASSWORD=test-password-12345 npm run setup && DATABASE_PATH=/tmp/tableq-e2e/tableq.sqlite APP_URL=http://localhost:3100 npm start -- --port 3100",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
