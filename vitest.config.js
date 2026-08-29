import { defineConfig } from "vitest/config";

// Node environment, not jsdom: everything under test is pure logic or fetch
// mocking. App.jsx has no module-level DOM access, so the only browser global
// it needs is localStorage, which setup.js stubs in ~10 lines. That keeps the
// suite dependency-light and fast enough to actually run.
//
// TZ is pinned in the npm script rather than here — Node reads it at startup,
// and localDate's whole job is to be correct in a non-UTC zone.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/__tests__/**/*.test.js"],
  },
});
