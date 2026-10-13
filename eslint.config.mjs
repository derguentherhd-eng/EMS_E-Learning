/*
 * eslint.config.mjs – Prüfregeln für JavaScript (optional, nur für die Entwicklung)
 *
 * Grundlage: die von ESLint empfohlenen Regeln plus die Regeln aus dem MDN-Styleguide
 * („Guidelines for writing JavaScript code examples"): const/let statt var, === statt ==,
 * immer geschweifte Klammern, Funktionsdeklarationen für benannte Funktionen,
 * Template-Literale, Objekt-Kurzschreibweise u. a.
 *
 * Benutzen (einmalig, legt node_modules/ an – wird nicht ins Repository übernommen):
 *   npm install --no-save eslint@9 @eslint/js@9 globals
 *   npx eslint js
 * In VS Code zeigt die Erweiterung „ESLint" die Meldungen dann direkt im Code.
 */
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "vendor/**",
      "content/inhalte.js",
      "assets/**",
      "node_modules/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      // Klassische Skripte (keine ES-Module), damit alles per Doppelklick läuft.
      sourceType: "script",
      globals: { ...globals.browser, EM: "readonly" },
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-unused-vars": ["error", { args: "after-used", caughtErrors: "none" }],
      strict: ["error", "function"],
      "no-implicit-globals": "error",
      curly: ["error", "all"],
      "no-shadow": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "object-shorthand": ["error", "always"],
      "prefer-template": "error",
      "no-else-return": "error",
      "func-style": ["error", "declaration"],
      "prefer-arrow-callback": "error",
      "one-var": ["error", "never"],
      "no-array-constructor": "error",
      "prefer-object-has-own": "error",
      "no-implicit-coercion": "error",
      "no-alert": "error",
      "no-useless-concat": "error",
      "arrow-body-style": ["error", "as-needed"],
      "default-case-last": "error",
      "no-unneeded-ternary": "error",
      "dot-notation": "error",
      "no-lonely-if": "error",
      "no-useless-return": "error",
    },
  },
];
