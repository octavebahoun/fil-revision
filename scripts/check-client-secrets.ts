/**
 * pnpm audit:secrets — après `pnpm build`, parcourt le JavaScript livré au navigateur
 * et échoue s'il contient une clé secrète (valeur exacte ou motif reconnaissable).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "./lib/load-env";

loadEnv({ extra: [".env.test.local", ".env.localstack"] });

const SECRET_VARS = [
  "DEEPSEEK_API_KEY",
  "META_API_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "VERCEL_TOKEN",
  "VAPID_PRIVATE_KEY",
  "CRON_SECRET",
  "JOBS_SECRET",
];
const PATTERNS = [
  /sb_secret_[A-Za-z0-9_-]{10,}/,
  /\bsk-[A-Za-z0-9]{20,}/,
  /SUPABASE_SECRET_KEY/,
  /DEEPSEEK_API_KEY/,
  /META_API_KEY/,
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs|json|html|txt|map)$/.test(p)) out.push(p);
  }
  return out;
}

const roots = [".next/static", "public"];
const files = roots.flatMap((r) => walk(r));
if (!existsSync(".next/static")) {
  console.error("Lance `pnpm build` avant `pnpm audit:secrets`.");
  process.exit(1);
}
const values = SECRET_VARS.map((k) => [k, process.env[k]] as const).filter(([, v]) => v && v.length >= 12);
const leaks: string[] = [];
for (const f of files) {
  const content = readFileSync(f, "utf8");
  for (const [k, v] of values) if (content.includes(v!)) leaks.push(`${f} contient la valeur de ${k}`);
  for (const re of PATTERNS) if (re.test(content)) leaks.push(`${f} contient le motif ${re.source.slice(0, 20)}`);
}
if (leaks.length) {
  console.error("Fuite de secret dans le build client :");
  for (const l of leaks) console.error(" - " + l);
  process.exit(1);
}
console.log(
  `Aucun secret dans le build client (${files.length} fichiers analysés, ${values.length} valeurs vérifiées).`,
);
