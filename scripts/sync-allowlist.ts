/**
 * Copie ALLOWED_EMAILS (.env) dans la liste blanche de la base (hook d'inscription).
 * Usage : pnpm allowlist:sync          (Supabase local)
 *         pnpm allowlist:sync --prod   (Supabase cloud)
 */
import { createClient } from "@supabase/supabase-js";
import { isProdFlag, loadEnv } from "./lib/load-env";

loadEnv({ prod: isProdFlag() });
const emails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter((e) => e.includes("@"));
const extra = (process.env.EXTRA_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const { data, error } = await supabase.rpc("admin_set_allowed_emails", { p_emails: [...emails, ...extra] });
if (error) {
  console.error("Échec de la synchronisation :", error.code);
  process.exit(1);
}
console.log(`Liste blanche synchronisée : ${data} adresse(s).`);
