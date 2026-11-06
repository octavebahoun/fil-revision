import type { Json } from "@/lib/database.types";
import { AiError } from "@/lib/ai/types";
import { log, errorCode } from "@/lib/log";
import { JobFatal, type JobContext, type JobHandler, type JobRow, type StepResult } from "./types";
import { ingestHandler } from "./handlers/ingest";
import { generateHandler } from "./handlers/generate";
import { exerciseGuideHandler } from "./handlers/exercise";
import { regenerateCardHandler } from "./handlers/regenerate";
import { mindmapHandler } from "./handlers/mindmap";

const HANDLERS: Record<JobRow["type"], JobHandler> = {
  ingest_document: ingestHandler,
  generate_notion: generateHandler,
  exercise_guide: exerciseGuideHandler,
  regenerate_card: regenerateCardHandler,
  mindmap: mindmapHandler,
};

// Meta raisonne avant de répondre (jusqu'à ~110 s par appel) : une étape peut dépasser 60 s.
// Le bail dépasse la durée maximale d'une fonction Vercel (300 s) pour qu'aucun job ne soit repris en double.
const LEASE_SECONDS = 330;
const STEP_MAX_MS = 120_000;

function nextParisMidnight(now: Date): Date {
  const d = new Date(now.getTime() + 24 * 3600 * 1000);
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  // ~minuit à Paris (+5 min de marge) ; à une heure près selon l'heure d'été, sans importance ici.
  return new Date(`${s}T00:05:00+01:00`);
}

async function applyResult(ctx: JobContext, job: JobRow, result: StepResult) {
  const base = { locked_until: null as string | null };
  if (result.kind === "continue") {
    const payload = { ...(job.payload as Record<string, Json>), ...(result.payload ?? {}) } as { [k: string]: Json };
    await ctx.db
      .from("jobs")
      .update({
        ...base,
        status: "queued",
        step: result.step,
        payload,
        attempts: 0,
        progress: result.progress ?? job.progress,
        total: result.total ?? job.total,
        run_after: (result.runAfter ?? ctx.now()).toISOString(),
        last_error: null,
      })
      .eq("id", job.id);
  } else if (result.kind === "done") {
    await ctx.db
      .from("jobs")
      .update({
        ...base,
        status: "done",
        progress: result.progress ?? job.total,
        total: result.total ?? job.total,
        last_error: null,
      })
      .eq("id", job.id);
  } else {
    await ctx.db
      .from("jobs")
      .update({ ...base, status: "error", last_error: result.message })
      .eq("id", job.id);
    await HANDLERS[job.type].onFail?.(job, ctx, result.message);
  }
}

async function runOne(ctx: JobContext, job: JobRow): Promise<void> {
  const handler = HANDLERS[job.type];
  try {
    const result = await handler.run(job, ctx);
    await applyResult(ctx, job, result);
  } catch (err) {
    if (err instanceof AiError && err.code === "budget") {
      log("info", "job_paused_budget", { job: job.id, type: job.type });
      await ctx.db
        .from("jobs")
        .update({
          status: "queued",
          locked_until: null,
          attempts: Math.max(0, job.attempts - 1),
          run_after: nextParisMidnight(ctx.now()).toISOString(),
          last_error: "budget",
        })
        .eq("id", job.id);
      return;
    }
    const fatal = err instanceof JobFatal;
    const message = fatal ? err.message : "Un souci technique est survenu. Nouvel essai automatique.";
    log(fatal ? "warn" : "error", "job_step_failed", {
      job: job.id,
      type: job.type,
      step: job.step,
      code: errorCode(err),
      attempt: job.attempts,
    });
    if (fatal || job.attempts >= job.max_attempts) {
      await applyResult(ctx, job, {
        kind: "fail",
        message: fatal ? message : "Le traitement n'a pas abouti après plusieurs essais. Tu peux le relancer.",
      });
      return;
    }
    const backoffMs = Math.min(15 * 60_000, 15_000 * 2 ** (job.attempts - 1));
    await ctx.db
      .from("jobs")
      .update({
        status: "queued",
        locked_until: null,
        run_after: new Date(ctx.now().getTime() + backoffMs).toISOString(),
        last_error: message,
      })
      .eq("id", job.id);
  }
}

/**
 * Traite des étapes de jobs jusqu'à épuisement du temps imparti.
 * Chaque étape dure moins de 60 s ; on ne démarre une étape que s'il reste assez de temps.
 */
export async function processJobs(
  ctx: JobContext,
  opts: { userId?: string; budgetMs: number; concurrency?: number; onProgress?: (n: number) => void },
): Promise<{ steps: number; idle: boolean }> {
  const started = Date.now();
  const concurrency = opts.concurrency ?? 4;
  let steps = 0;
  for (let round = 0; ; round++) {
    // Toujours au moins un tour ; ensuite, on ne repart que s'il reste le temps d'une étape complète.
    if (round > 0 && opts.budgetMs - (Date.now() - started) < STEP_MAX_MS) return { steps, idle: false };
    const { data: jobs, error } = await ctx.db.rpc("claim_jobs", {
      p_limit: concurrency,
      p_lease_seconds: LEASE_SECONDS,
      p_user: opts.userId,
    });
    if (error) {
      log("error", "claim_jobs_failed", { code: error.code });
      return { steps, idle: false };
    }
    if (!jobs || jobs.length === 0) return { steps, idle: true };
    await Promise.all(jobs.map((j) => runOne(ctx, j)));
    steps += jobs.length;
    opts.onProgress?.(steps);
  }
}
