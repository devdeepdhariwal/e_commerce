import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.js"],
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
    reporters: ["default", "json"],
    outputFile: "./test-results.json",
  },
});
