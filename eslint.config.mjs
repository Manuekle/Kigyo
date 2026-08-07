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
]);

export default eslintConfig;
