import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated and tool-owned. `.claude/worktrees` holds throwaway checkouts
    // with their own .next build output; src/lib/supabase/types.ts is emitted
    // by scripts/gen-db-types.mjs.
    ".claude/**",
    "**/.next/**",
    "src/lib/supabase/types.ts",
  ]),
  {
    rules: {
      // El guion bajo es la forma de decir «este parámetro existe para cumplir
      // la firma y no se usa» — `parse(rawBody, _headers)` en el proveedor de
      // billing es exactamente eso. Sin esta regla, la única salida es borrar
      // el nombre y perder la documentación de qué recibe la función.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
]);

export default eslintConfig;
