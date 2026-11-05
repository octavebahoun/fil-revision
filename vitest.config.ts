import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import path from "node:path";

function loadTestEnv() {
  const env: Record<string, string> = {};
  // TEST_TARGET=prod : uniquement les tests RLS, contre Supabase cloud (comptes temporaires supprimés après).
  const files = process.env.TEST_TARGET === "prod" ? [".env"] : [".env", ".env.development.local", ".env.test.local"];
  for (const f of files) {
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
        // Câblage et accès aux requêtes Next (couverts par les tests E2E), pas du code métier :
        "src/lib/empty-module.ts",
        "src/lib/auth/session.ts",
        "src/lib/jobs/run.ts",
        "src/lib/ai/server.ts",
        "src/lib/data/**",
        "src/lib/push/send.ts",
      ],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
      reporter: ["text-summary", "json-summary"],
    },
  },
});
