// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/graphify-out/**",
      "**/coverage/**",
      "blueprint/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }]
    }
  },
  {
    // Builder UI rule (owner, 2026-11-16): checks and selects are the HeroUI controls in
    // components/ui (CheckField, Toggle, SelectField), never raw browser inputs.
    files: ["apps/editor/src/**/*.tsx"],
    ignores: ["apps/editor/src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "Use SelectField from components/ui/controls, not a raw <select>."
        },
        {
          selector:
            "JSXOpeningElement[name.name='input']:has(JSXAttribute[name.name='type'][value.value=/^(checkbox|radio)$/])",
          message:
            "Use CheckField or Toggle from components/ui/controls, not a raw checkbox or radio."
        }
      ]
    }
  },
  eslintConfigPrettier
);
