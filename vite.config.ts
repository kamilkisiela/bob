import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    deps: {
      // fixes `fs-extra` errors
      inline: true,
      fallbackCJS: true,
    },
    setupFiles: ['./serializer.js'],
  },
});
