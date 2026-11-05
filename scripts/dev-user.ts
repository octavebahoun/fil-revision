/**
 * Crée le compte LOCAL (Supabase local uniquement) pour le premier e-mail autorisé.
 * Le mot de passe est généré et rangé dans .env.development.local (DEV_USER_PASSWORD), jamais affiché.
 * Usage : pnpm dev:user [email]
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/load-env";

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error("Ce script ne fonctionne qu'avec Supabase local.");
  process.exit(1);
}
const email = (process.argv[2] ?? (process.env.ALLOWED_EMAILS ?? "").split(",")[0] ?? "").trim().toLowerCase();
const db = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
if (data?.users.some((u) => u.email === email)) {
  console.log(`Le compte local ${email} existe déjà.`);
  process.exit(0);
}
let password = process.env.DEV_USER_PASSWORD;
if (!password) {
  password = `Fil-${randomBytes(9).toString("base64url")}-7`;
  const current = readFileSync(".env.development.local", "utf8");
  appendFileSync(".env.development.local", `${current.endsWith("\n") ? "" : "\n"}DEV_USER_PASSWORD=${password}\n`);
}
await db.rpc("admin_allow_email", { p_email: email });
const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  console.error("Création impossible :", error.code ?? error.message);
  process.exit(1);
}
console.log(`Compte local créé pour ${email}. Mot de passe : voir DEV_USER_PASSWORD dans .env.development.local.`);
