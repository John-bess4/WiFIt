import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Report-only lint. Exactly two diagnostic rules are on: no-undef and
// no-unused-vars. Everything stylistic stays off — string concatenation over
// template literals is intentional in this codebase, not a finding.
export default [
  { ignores: ["dist/**", "node_modules/**"] },

  // Browser app
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        // Vendor-prefixed / partially-standard APIs this app actually calls.
        SpeechRecognition: "readonly",
        webkitSpeechRecognition: "readonly",
        webkitAudioContext: "readonly",
      },
    },
    settings: { react: { version: "detect" } },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn",
      // Emits no diagnostics of its own. It only teaches no-unused-vars that
      // `<Foo/>` is a use of `Foo`; without it every component in the file is
      // falsely reported as unused.
      "react/jsx-uses-vars": "error",
      // The third diagnostic rule, and it earned its place. renderMsg called
      // useState inside a branch, and renderMsg runs in a .map — so the panel's
      // hook count tracked how many recipe messages existed, the first recipe
      // card threw "Rendered more hooks than during the previous render", and
      // with no error boundary the whole app went blank. That shipped and went
      // undetected. This is a correctness rule, not a stylistic one, so it is an
      // error. It finds nothing today; it is here to stop a recurrence.
      //
      // react-hooks/exhaustive-deps is deliberately NOT enabled: it reports 7
      // advisory warnings that are a separate triage, and this config stays
      // report-only with a stable baseline.
      "react-hooks/rules-of-hooks": "error",
    },
  },

  // Vercel Edge Function: web globals (fetch/Request/Response) plus process.env
  {
    files: ["api/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn",
    },
  },
];
