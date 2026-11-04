/**
 * Écrit les clés de Supabase local (supabase status) dans :
 * - .env.development.local : utilisé par `pnpm dev` (prioritaire sur .env)
 * - .env.test.local        : utilisé par Vitest / Playwright (IA simulée)
 * - .env.localstack        : utilisé par `pnpm start:local` (build de prod contre Supabase local)
 * Aucune valeur n'est affichée.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

type Status = { API_URL: string; PUBLISHABLE_KEY: string; SECRET_KEY: string; DB_URL: string; MAILPIT_URL: string };

const out = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], { encoding: "utf8" });
const json = out.slice(out.indexOf("{"));
const s = JSON.parse(json) as Status;

const base = [
  "# Généré par scripts/env-local.ts — Supabase local. Ne pas commiter.",
  `NEXT_PUBLIC_SUPABASE_URL=${s.API_URL}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${s.PUBLISHABLE_KEY}`,
  `SUPABASE_SECRET_KEY=${s.SECRET_KEY}`,
  `SUPABASE_DB_URL=${s.DB_URL}`,
  `MAILPIT_URL=${s.MAILPIT_URL}`,
  `NEXT_PUBLIC_SITE_URL=http://localhost:3000`,
];

writeFileSync(".env.development.local", base.join("\n") + "\n", { mode: 0o600 });
writeFileSync(
  ".env.test.local",
  [...base, "AI_PRIMARY_PROVIDER=mock", "AI_FALLBACK_PROVIDER=mock", "RATE_LIMIT_DISABLED=0"].join("\n") + "\n",
  { mode: 0o600 },
);
writeFileSync(".env.localstack", [...base, "AI_PRIMARY_PROVIDER=mock", "AI_FALLBACK_PROVIDER=mock"].join("\n") + "\n", {
  mode: 0o600,
});
console.log("Fichiers .env.development.local, .env.test.local et .env.localstack écrits.");
