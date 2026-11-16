import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: { port: 1420 },
  build: { target: ["chrome105", "safari15"] }
});
