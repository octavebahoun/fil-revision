/**
 * Crée le compte de production pour le premier e-mail autorisé (confirmé, mot de passe aléatoire jamais stocké).
 * L'utilisateur choisit ensuite son mot de passe via « Mot de passe oublié » sur l'app.
 * Usage : pnpm tsx scripts/create-prod-user.ts [email]
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/load-env";

loadEnv({ prod: true });
const email = (process.argv[2] ?? (process.env.ALLOWED_EMAILS ?? "").split(",")[0] ?? "").trim().toLowerCase();
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
if (data?.users.some((u) => u.email === email)) {
  console.log(`Le compte ${email} existe déjà.`);
  process.exit(0);
}
const { error } = await db.auth.admin.createUser({
  email,
  password: randomBytes(24).toString("base64url") + "a1",
  email_confirm: true,
});
if (error) {
  console.error("Création impossible :", error.code ?? error.message);
  process.exit(1);
}
console.log(`Compte créé pour ${email}. Choisis ton mot de passe via « Mot de passe oublié ».`);
