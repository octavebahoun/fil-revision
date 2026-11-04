/**
 * Génère les secrets internes manquants et les ajoute à .env (sans jamais les afficher).
 * Usage : pnpm gen:secrets
 * - NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (notifications push)
 * - CRON_SECRET (déclenchement des tâches planifiées)
 * - JOBS_SECRET (appel interne du worker de jobs)
 * Idempotent : une variable déjà remplie n'est jamais écrasée.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
import webpush from "web-push";

const ENV_PATH = process.argv[2] ?? ".env";

function main() {
  if (!existsSync(ENV_PATH)) writeFileSync(ENV_PATH, "", { mode: 0o600 });
  const raw = readFileSync(ENV_PATH, "utf8");
  const env = parse(raw);
  const additions: Record<string, string> = {};
  const has = (k: string) => Boolean(env[k] && env[k].trim() !== "");

  if (!has("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || !has("VAPID_PRIVATE_KEY")) {
    const keys = webpush.generateVAPIDKeys();
    additions.NEXT_PUBLIC_VAPID_PUBLIC_KEY = keys.publicKey;
    additions.VAPID_PRIVATE_KEY = keys.privateKey;
  }
  if (!has("VAPID_SUBJECT")) {
    const first = (env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .find((e) => e.includes("@"));
    additions.VAPID_SUBJECT = `mailto:${first ?? "admin@example.invalid"}`;
  }
  if (!has("CRON_SECRET")) additions.CRON_SECRET = randomBytes(32).toString("hex");
  if (!has("JOBS_SECRET")) additions.JOBS_SECRET = randomBytes(32).toString("hex");

  const keys = Object.keys(additions);
  if (keys.length === 0) {
    console.log("Aucun secret à générer : tout est déjà rempli.");
    return;
  }
  // Supprime les lignes vides existantes pour ces clés, puis ajoute les valeurs.
  const kept = raw
    .split("\n")
    .filter((line) => !keys.some((k) => new RegExp(`^\\s*${k}\\s*=\\s*$`).test(line)))
    .join("\n");
  writeFileSync(ENV_PATH, kept.endsWith("\n") || kept === "" ? kept : kept + "\n", { mode: 0o600 });
  appendFileSync(
    ENV_PATH,
    "\n# Secrets internes générés par scripts/gen-secrets (ne pas partager)\n" +
      keys.map((k) => `${k}=${additions[k]}`).join("\n") +
      "\n",
  );
  console.log(`Secrets ajoutés à ${ENV_PATH} : ${keys.join(", ")}`);
}

main();
