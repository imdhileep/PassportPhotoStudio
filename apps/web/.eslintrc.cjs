module.exports = {
  root: true,
  env: { browser: true, es2021: true, worker: true },
  // NOTE: plugin:react-refresh/recommended is intentionally NOT extended. react-refresh >=0.4.20
  // ships a flat-config preset with a top-level `name` key that the legacy .eslintrc schema rejects
  // (ESLint 8), which crashed `npm run lint`. The plugin is still registered below and its only rule
  // is configured directly in `rules`.
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  // The TS source was never actually linted before: no TypeScript parser was configured, so every
  // .ts/.tsx file failed with "Parsing error". @typescript-eslint/parser fixes that.
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  // Generated/vendored assets and build output are not source — never lint them.
  ignorePatterns: ["dist", "public", "node_modules", "*.config.*", ".eslintrc.cjs"],
  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
  rules: {
    "react-refresh/only-export-components": "off",
    // no-undef is redundant (and buggy) for TS — the compiler already checks this.
    "no-undef": "off",
    // Prefer the TS-aware unused-vars rule; allow intentional _-prefixed args/vars.
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
    ]
  }
};
