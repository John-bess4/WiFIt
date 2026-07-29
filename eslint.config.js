import globals from "globals";
import react from "eslint-plugin-react";

// Report-only lint. Exactly two diagnostic rules are on: no-undef and
// no-unused-vars. Everything stylistic stays off — string concatenation over
// template literals is intentional in this codebase, not a finding.
export default [
  { ignores: ["dist/**", "node_modules/**"] },

  // Browser app
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react },
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
