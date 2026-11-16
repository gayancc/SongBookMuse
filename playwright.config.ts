import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/ui",
  workers: 1,
  timeout: 80_000,
  expect: { timeout: 12_000 },
  reporter: "list"
});
