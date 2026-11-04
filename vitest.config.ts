import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import path from "node:path";

function loadTestEnv() {
  const env: Record<string, string> = {};
  for (const f of [".env", ".env.development.local", ".env.test.local"]) {
    if (existsSync(f)) Object.assign(env, parse(readFileSync(f, "utf8")));
  }
  return env;
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/empty.ts"),
    },
  },
  test: {
    env: loadTestEnv(),
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/database.types.ts",
        "src/lib/supabase/**",
        "src/lib/**/actions.ts",
        "src/lib/**/*-actions.ts",
        "src/lib/env.ts",
        "src/lib/request.ts",
        "src/lib/utils.ts",
        "src/lib/offline/**",
        "src/lib/client/**",
      ],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
      reporter: ["text-summary", "json-summary"],
    },
  },
});
