import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: { port: 1420 },
  build: {
    target: ["chrome105", "safari15"],
    // The startup splash is its own lightweight page so it paints before the app bundle loads.
    rollupOptions: { input: { main: "index.html", splash: "splash.html" } }
  }
});
