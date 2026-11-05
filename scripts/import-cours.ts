/**
 * Import en masse : pnpm import:cours <chemin> [--email moi@exemple.fr] [--prod] [--no-wait]
 * - une sous-dossier = une matière (les dossiers vides deviennent des matières à venir) ;
 * - idempotent : un fichier déjà importé (même empreinte SHA-256) est ignoré, un nouveau est détecté ;
 * - le dossier source n'est jamais modifié (lecture seule) ;
 * - traite ensuite les jobs (extraction, notions, génération) jusqu'au bout, sauf --no-wait ;
 * - un cours dont la préparation dépasse le seuil de coût attend une confirmation : --yes la donne.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { isProdFlag, loadEnv } from "./lib/load-env";

loadEnv({ prod: isProdFlag() });

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--email");
const emailArg = args.includes("--email") ? args[args.indexOf("--email") + 1] : undefined;
const wait = !args.includes("--no-wait");
const yes = args.includes("--yes");

if (!root || !existsSync(root) || !statSync(root).isDirectory()) {
  console.error("Usage : pnpm import:cours <dossier> [--email adresse] [--prod] [--no-wait]");
  process.exit(1);
}

const { planSubjects, IGNORED_DIRS } = await import("../src/lib/ingest/subjects");
const { registerFile, ensureSubject } = await import("../src/lib/courses/register");
type Entry = { path: string; type: "file" | "dir" };

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = (emailArg ?? (process.env.ALLOWED_EMAILS ?? "").split(",")[0] ?? "").trim().toLowerCase();
const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const user = users?.users.find((u) => u.email?.toLowerCase() === email);
if (!user) {
  console.error(`Aucun compte pour ${email}. Crée d'abord le compte (inscription dans l'app).`);
  process.exit(1);
}

const entries: Entry[] = [];
function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const rel = path.relative(root!, p);
    if (statSync(p).isDirectory()) {
      entries.push({ path: rel, type: "dir" });
      // Les dépendances et environnements (venv, node_modules…) ne sont jamais parcourus.
      if (!IGNORED_DIRS.test(name) && !name.startsWith(".")) walk(p);
    } else entries.push({ path: rel, type: "file" });
  }
}
walk(root);

const plan = planSubjects(entries);
let created = 0;
let duplicates = 0;
let rejected = 0;
for (const [i, s] of plan.entries()) {
  const subjectId = await ensureSubject(db as never, {
    userId: user.id,
    name: s.name,
    slug: s.slug,
    kind: s.kind,
    language: /introductory|english|anglais/i.test(s.name) ? "en" : "fr",
    position: i,
  });
  console.log(`• ${s.name}${s.files.length ? "" : " (à venir)"}`);
  for (const f of s.files) {
    const bytes = new Uint8Array(readFileSync(path.join(root, f)));
    const res = await registerFile(db as never, {
      userId: user.id,
      subjectId,
      filename: path.basename(f),
      bytes,
      origin: "import",
      autoConfirm: yes,
    });
    if (res.status === "created") {
      created++;
      console.log(`   + ${path.basename(f)}`);
    } else if (res.status === "duplicate") {
      duplicates++;
      console.log(`   = ${path.basename(f)} (déjà importé)`);
    } else {
      rejected++;
      console.log(`   ✗ ${path.basename(f)} : ${res.reason}`);
    }
  }
}
console.log(`\n${created} nouveau(x), ${duplicates} déjà importé(s), ${rejected} refusé(s).`);

if (wait) {
  // Le worker s'exécute ici, sans limite de durée de fonction ; même code qu'en production.
  const { processJobs } = await import("../src/lib/jobs/worker");
  const { AiRouter } = await import("../src/lib/ai/router");
  const { supabaseAiStore } = await import("../src/lib/ai/server");
  const { buildProviders } = await import("../src/lib/ai/providers");
  const e = process.env;
  const providers = buildProviders(e as Record<string, string>);
  const ai = new AiRouter(providers, supabaseAiStore, Number(e.AI_DAILY_BUDGET_USD ?? 2));
  const { jobConfigFromEnv } = await import("../src/lib/jobs/types");
  const ctx = { db: db as never, ai, now: () => new Date(), config: jobConfigFromEnv(e) };
  console.log(`\nTraitement (${providers.map((p) => p.name).join(" → ")})…`);
  const started = Date.now();
  for (;;) {
    const r = await processJobs(ctx, {
      userId: user.id,
      budgetMs: 10 * 60_000,
      concurrency: Number(e.IMPORT_CONCURRENCY ?? 6),
    });
    const { count: left } = await db
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["queued", "running"])
      .lte("run_after", new Date().toISOString());
    const { count: paused } = await db
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "queued")
      .gt("run_after", new Date().toISOString());
    console.log(
      `  ${r.steps} étape(s) · reste ${left ?? 0} prêt(s), ${paused ?? 0} en attente · ${Math.round((Date.now() - started) / 1000)} s`,
    );
    if (r.idle && (left ?? 0) === 0) {
      // Cours en attente de confirmation (estimation au-dessus du seuil).
      const { data: waiting } = await db
        .from("documents")
        .select("id, title, estimated_cost_usd")
        .eq("user_id", user.id)
        .eq("status", "awaiting_confirmation");
      if (waiting?.length && yes) {
        const { enqueueGeneration } = await import("../src/lib/jobs/plan");
        for (const d of waiting) await enqueueGeneration(db as never, user.id, d.id);
        console.log(`Génération confirmée pour ${waiting.length} cours.`);
        continue;
      }
      if (waiting?.length) {
        const total = waiting.reduce((s, d) => s + Number(d.estimated_cost_usd ?? 0), 0);
        console.log("\nEstimation avant génération :");
        for (const d of waiting) console.log(`  ~${Number(d.estimated_cost_usd ?? 0).toFixed(3)} $  ${d.title}`);
        console.log(`  Total ~${total.toFixed(2)} $. Pour lancer : relance la même commande avec --yes.`);
      }
      if ((paused ?? 0) > 0)
        console.log("Certains traitements reprendront plus tard (nouvel essai ou budget du jour atteint).");
      break;
    }
  }
}
