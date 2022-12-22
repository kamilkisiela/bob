import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    deps: {
      // fixes `fs-extra` TypeError: readFileSync is not a function
      inline: true,
    },
    setupFiles: ["./serializer.js"],
  },
});
