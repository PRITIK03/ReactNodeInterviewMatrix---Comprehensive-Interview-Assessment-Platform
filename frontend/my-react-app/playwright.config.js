import { defineConfig } from "@playwright/test";
import process from "node:process";
export default defineConfig({
  testDir: "e2e",
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:5191",
    channel: process.env.MATRIX_BROWSER_CHANNEL || undefined,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5191 --strictPort",
    url: "http://127.0.0.1:5191",
    reuseExistingServer: false,
  },
});
