/**
 * Configure Supabase cloud (idempotent) via l'API Management :
 * - Auth : URL du site, redirections, hook de liste blanche, mot de passe, e-mails en français ;
 * - Vault : URL de l'app et CRON_SECRET pour le planificateur (pg_cron → /api/jobs/tick) ;
 * - liste blanche d'inscription (ALLOWED_EMAILS).
 * Usage : pnpm setup:prod --url https://fil-revision.vercel.app
 * Aucune valeur secrète n'est affichée.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/load-env";

loadEnv({ prod: true });
const urlArg = process.argv[process.argv.indexOf("--url") + 1];
if (!process.argv.includes("--url") || !urlArg?.startsWith("https://")) {
  console.error("Usage : pnpm setup:prod --url https://<projet>.vercel.app");
  process.exit(1);
}
const appUrl = urlArg.replace(/\/$/, "");
const e = process.env;
const ref = e.SUPABASE_PROJECT_REF!;
const api = `https://api.supabase.com/v1/projects/${ref}`;
const headers = { authorization: `Bearer ${e.SUPABASE_ACCESS_TOKEN}`, "content-type": "application/json" };

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`${api}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json().catch(() => null);
}

const tpl = (name: string) => readFileSync(`supabase/templates/${name}.html`, "utf8");

await call("/config/auth", "PATCH", {
  site_url: appUrl,
  uri_allow_list: [`${appUrl}/**`, "http://localhost:3000/**"].join(","),
  disable_signup: false,
  mailer_autoconfirm: false,
  external_email_enabled: true,
  password_min_length: 10,
  password_required_characters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
  hook_before_user_created_enabled: true,
  hook_before_user_created_uri: "pg-functions://postgres/public/hook_before_user_created",
  // Les modèles d'e-mail en français (supabase/templates) exigent un SMTP personnalisé sur l'offre
  // gratuite : sans SMTP, on garde les modèles par défaut (liens PKCE gérés par /auth/callback).
  ...(e.SMTP_CONFIGURED === "1"
    ? {
        mailer_subjects_confirmation: "Confirme ton adresse pour Fil",
        mailer_templates_confirmation_content: tpl("confirmation"),
        mailer_subjects_recovery: "Ton nouveau mot de passe Fil",
        mailer_templates_recovery_content: tpl("recovery"),
      }
    : {}),
});
console.log("Auth configurée (hook de liste blanche actif).");

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const upsertSecret = (name: string, value: string) => `
  do $$ begin
    if exists (select 1 from vault.secrets where name = ${lit(name)}) then
      perform vault.update_secret((select id from vault.secrets where name = ${lit(name)}), ${lit(value)});
    else
      perform vault.create_secret(${lit(value)}, ${lit(name)});
    end if;
  end $$;`;
await call("/database/query", "POST", {
  query: upsertSecret("app_url", appUrl) + upsertSecret("cron_secret", e.CRON_SECRET!),
});
console.log("Secrets du planificateur enregistrés dans Vault.");

const emails = (e.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter((x) => x.includes("@"));
const db = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const { data, error } = await db.rpc("admin_set_allowed_emails", { p_emails: emails });
if (error) throw new Error(`Liste blanche : ${error.code}`);
console.log(`Liste blanche : ${data} adresse(s).`);
