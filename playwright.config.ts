import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 75_000,
  use: { baseURL: "http://127.0.0.1:4319", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4319",
    timeout: 30_000,
    env: {
      PORT: "4319",
      HUB_DATA_DIR: join(tmpdir(), `hub-e2e-${process.pid}-${Date.now()}`),
    },
    reuseExistingServer: false,
  },
});
