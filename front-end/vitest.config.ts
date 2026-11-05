import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname) } },
  test: {
    include: ["tests/money/**/*.test.ts"],
    globalSetup: ["tests/money/global-setup.ts"],
    // All tests share one database.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
