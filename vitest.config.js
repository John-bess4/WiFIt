import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Node environment by default: everything under test is pure logic or fetch
// mocking. App.jsx has no module-level DOM access, so the only browser global
// it needs is localStorage, which setup.js stubs in ~10 lines.
//
// Component tests opt in to jsdom per file with `// @vitest-environment jsdom`
// (see homeTab.test.jsx). No testing-library: react-dom/client + act() is
// enough for "does this render the demo numbers" and "did the handler fire".
//
// TZ is pinned in the npm script rather than here — Node reads it at startup,
// and localDate's whole job is to be correct in a non-UTC zone.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    // jsdom component renders (homeTab, ui, tabErrorBoundary) can exceed the 5s
    // default under full-suite load; the logic tests are all sub-ms.
    testTimeout: 20000,
    setupFiles: ["./src/test/setup.js"],
    include: ["src/__tests__/**/*.test.{js,jsx}"],
  },
});
