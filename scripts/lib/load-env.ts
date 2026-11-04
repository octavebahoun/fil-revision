/**
 * Charge l'environnement pour les scripts CLI.
 * - par défaut : .env puis .env.development.local (Supabase local) ;
 * - avec --prod : uniquement .env (Supabase cloud).
 * Les fichiers suivants écrasent les précédents ; une variable déjà définie par le shell est conservée.
 */
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

export function loadEnv(opts: { prod?: boolean; extra?: string[] } = {}) {
  const fromShell = new Set(Object.keys(process.env));
  const files = [".env", ...(opts.prod ? [] : [".env.development.local"]), ...(opts.extra ?? [])];
  const merged: Record<string, string> = {};
  for (const f of files) {
    if (existsSync(f)) Object.assign(merged, parse(readFileSync(f, "utf8")));
  }
  for (const [k, v] of Object.entries(merged)) {
    if (!fromShell.has(k)) process.env[k] = v;
  }
}

export function isProdFlag() {
  return process.argv.includes("--prod");
}
