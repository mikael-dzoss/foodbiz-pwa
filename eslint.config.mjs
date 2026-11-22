import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // i18n guard: manager UI copy lives in `src/domain/i18n` dictionaries, never in JSX literals.
  {
    files: [
      "src/features/{auth,customers,dashboard,expenses,manager,orders,products,settings}/components/**/*.tsx",
      "src/app/manage/**/*.tsx",
    ],
    ignores: ["**/tests/**", "**/*.test.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: false,
          // Symbols and punctuation that carry no language.
          allowedStrings: [
            "•",
            "·",
            "—",
            "–",
            "/",
            "(",
            ")",
            ":",
            "×",
            "-",
            "+",
            "%",
            "…",
            "#",
            "→",
            "←",
            "|",
            ",",
            ".",
            "€",
            "@",
            "FoodBiz",
            "F",
            "M",
            "*",
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|aria-description|aria-roledescription|title|placeholder|alt|label|description|helperText|emptyText|retryLabel)$/] > Literal[value=/[A-Za-z]{2}/]",
          message: "User-facing attribute text belongs in a dictionary (src/domain/i18n).",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|aria-description|title|placeholder|alt|label|description|helperText|emptyText|retryLabel)$/] > JSXExpressionContainer > Literal[value=/[A-Za-z]{2}/]",
          message: "User-facing attribute text belongs in a dictionary (src/domain/i18n).",
        },
        {
          selector:
            "CallExpression[callee.name=/^(showToast|toast|set[A-Za-z]*(Error|Message|Notice))$/] > Literal[value=/[A-Za-z]{2}/]",
          message: "Toast text belongs in a dictionary (src/domain/i18n).",
        },
        {
          selector:
            "CallExpression[callee.name=/^(showToast|toast|set[A-Za-z]*(Error|Message|Notice))$/] > TemplateLiteral",
          message: "Toast text belongs in a dictionary (src/domain/i18n).",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "playwright-report-supabase/**",
    "test-results-supabase/**",
    ".claude/worktrees/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
