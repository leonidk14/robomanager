import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import jsxA11y from "eslint-plugin-jsx-a11y";

// The react, react-hooks, jsx-a11y and import plugins are registered by
// eslint-config-next for these files, so rules below only configure them.
const sourceFiles = ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"];
const tsFiles = ["**/*.{ts,tsx,mts,cts}"];

const eslintConfig = defineConfig([
  js.configs.recommended,
  ...nextVitals,
  ...nextTs,
  {
    name: "project/base",
    files: sourceFiles,
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,

      // Rules of hooks and the React Compiler rules are already errors via
      // eslint-config-next; missing effect dependencies are bugs too.
      "react-hooks/exhaustive-deps": "error",

      "react/jsx-no-useless-fragment": ["error", { allowExpressions: true }],
      "react/jsx-curly-brace-presence": ["error", { props: "never", children: "never" }],
      "react/self-closing-comp": "error",
      "react/no-array-index-key": "warn",

      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    name: "project/typescript",
    files: tsFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      // React ignores the return value of event handlers, so async handlers
      // passed as JSX props are allowed.
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
    },
  },
  // Turns off stylistic rules that conflict with Prettier; only rules that are
  // safe to combine with Prettier may be re-enabled after it.
  prettier,
  {
    name: "project/after-prettier",
    files: sourceFiles,
    rules: {
      // Braces around every if/else/for/while body, even one-liners.
      curly: ["error", "all"],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
