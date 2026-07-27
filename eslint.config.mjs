import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const config = [
  { ignores: [".next/**", "generated/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];

export default config;
