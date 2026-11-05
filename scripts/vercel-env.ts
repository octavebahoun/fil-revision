/**
 * Copie les variables utiles de .env vers Vercel (production), sans jamais les afficher.
 * Usage : pnpm vercel:env --url https://fil-revision.vercel.app
 */
import { spawnSync } from "node:child_process";
import { loadEnv } from "./lib/load-env";

loadEnv({ prod: true });
const url = process.argv[process.argv.indexOf("--url") + 1];
const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
  "META_API_KEY",
  "META_BASE_URL",
  "META_MODEL",
  "AI_PRIMARY_PROVIDER",
  "AI_FALLBACK_PROVIDER",
  "AI_DAILY_BUDGET_USD",
  "ALLOWED_EMAILS",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "CRON_SECRET",
  "JOBS_SECRET",
];
const values: Record<string, string> = Object.fromEntries(KEYS.map((k) => [k, process.env[k] ?? ""]));
values.DEEPSEEK_LIGHT_MODEL = process.env.DEEPSEEK_LIGHT_MODEL ?? "deepseek-flash";
if (url) values.NEXT_PUBLIC_SITE_URL = url.replace(/\/$/, "");
const token = process.env.VERCEL_TOKEN!;
for (const [k, v] of Object.entries(values)) {
  if (!v) {
    console.log(`  (vide, ignorée) ${k}`);
    continue;
  }
  spawnSync("vercel", ["env", "rm", k, "production", "--yes", "--token", token], { stdio: "ignore" });
  const r = spawnSync("vercel", ["env", "add", k, "production", "--token", token], { input: v, stdio: ["pipe", "ignore", "pipe"] });
  console.log(`  ${r.status === 0 ? "✓" : "✗"} ${k}${r.status === 0 ? "" : " : " + String(r.stderr).replace(token, "***").slice(0, 120)}`);
}
