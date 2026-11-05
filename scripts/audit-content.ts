/**
 * pnpm audit:content [--prod] [--email x] — contrôle automatique du contenu généré :
 * fiches de plus de 5 lignes, citations absentes de la source, noms propres / chiffres inventés.
 */
import { createClient } from "@supabase/supabase-js";
import { isProdFlag, loadEnv } from "./lib/load-env";

loadEnv({ prod: isProdFlag() });
const { ficheTooLong } = await import("../src/lib/content/schemas");
const { unsupportedFacts } = await import("../src/lib/ai/tasks/verify");
const { quoteSupported } = await import("../src/lib/text/normalize");
const { quizFacts } = await import("../src/lib/jobs/handlers/generate");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const email = (
  process.argv.includes("--email")
    ? process.argv[process.argv.indexOf("--email") + 1]
    : process.env.ALLOWED_EMAILS?.split(",")[0]
)!
  .trim()
  .toLowerCase();
const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const user = users.users.find((u) => u.email === email);
if (!user) throw new Error("compte introuvable");

type Row = {
  id: string;
  type: string;
  content: Record<string, unknown>;
  source_quote: string | null;
  notions: { title: string; source_text: string };
};
const rows: Row[] = [];
for (let from = 0; ; from += 500) {
  const { data } = await db
    .from("cards")
    .select("id, type, content, source_quote, notions!inner(title, source_text)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .range(from, from + 499);
  rows.push(...((data ?? []) as unknown as Row[]));
  if (!data || data.length < 500) break;
}
const s = (v: unknown) => (typeof v === "string" ? v : "");
const problems: string[] = [];
for (const r of rows) {
  const c = r.content;
  const src = r.notions.source_text;
  if (
    r.type === "fiche" &&
    ficheTooLong({ explanation: s(c.explanation), example: s(c.example), question: s(c.question) })
  )
    problems.push(`[trop longue] ${r.notions.title}`);
  if (r.source_quote && !quoteSupported(r.source_quote, src))
    problems.push(`[citation absente] ${r.type} · ${r.notions.title}`);
  const facts =
    r.type === "fiche"
      ? [s(c.explanation), s(c.example), s(c.answer)].join(". ")
      : r.type === "flashcard"
        ? `${s(c.front)}. ${s(c.back)}`
        : ["qcm", "vrai_faux", "reponse_courte", "code_trou", "ordre", "association"].includes(r.type)
          ? quizFacts({ type: r.type, ...c } as never)
          : "";
  const missing = facts ? unsupportedFacts(facts, src) : [];
  if (missing.length) problems.push(`[fait absent : ${missing.slice(0, 3).join(", ")}] ${r.type} · ${r.notions.title}`);
}
console.log(`${rows.length} cartes actives contrôlées, ${problems.length} problème(s).`);
for (const p of problems.slice(0, 40)) console.log(" - " + p);
process.exit(problems.length ? 1 : 0);
