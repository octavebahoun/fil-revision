/**
 * Copie le cache IA (sorties réelles déjà payées) du Supabase local vers la prod, pour le même e-mail.
 * Les clés sont des empreintes de contenu : un même cours importé en prod réutilise ces sorties sans repayer.
 * Usage : pnpm tsx scripts/copy-ai-cache.ts [email]
 */
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const read = (f: string) => (existsSync(f) ? parse(readFileSync(f, "utf8")) : {});
const prodEnv = read(".env");
const localEnv = { ...prodEnv, ...read(".env.development.local") };
const email = (process.argv[2] ?? (prodEnv.ALLOWED_EMAILS ?? "").split(",")[0] ?? "").trim().toLowerCase();
const local = createClient(localEnv.NEXT_PUBLIC_SUPABASE_URL!, localEnv.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const prod = createClient(prodEnv.NEXT_PUBLIC_SUPABASE_URL!, prodEnv.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

async function userId(db: typeof local) {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const u = data.users.find((x) => x.email === email);
  if (!u) throw new Error(`Compte ${email} introuvable`);
  return u.id;
}
const [from, to] = [await userId(local), await userId(prod)];
let copied = 0;
for (let offset = 0; ; offset += 500) {
  const { data } = await local
    .from("ai_cache")
    .select("key, purpose, output")
    .eq("user_id", from)
    .in("purpose", ["segment", "generate_fiche", "generate_quiz"])
    .range(offset, offset + 499);
  if (!data?.length) break;
  const { error } = await prod.from("ai_cache").upsert(
    data.map((r) => ({ user_id: to, key: r.key, purpose: r.purpose, output: r.output })),
    { onConflict: "user_id,key" },
  );
  if (error) throw new Error(error.code);
  copied += data.length;
  if (data.length < 500) break;
}
console.log(`${copied} entrée(s) de cache copiée(s) vers la prod.`);
