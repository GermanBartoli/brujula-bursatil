import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:5173", headless: true },
  webServer: {
    command: "pnpm run dev --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "escritorio", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "móvil", use: { viewport: { width: 390, height: 844 } } },
  ],
});
