import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiRouter } from "@/lib/ai/server";
import { processJobs } from "./worker";
import { jobConfigFromEnv, type JobContext } from "./types";

export function jobContext(): JobContext {
  return { db: createAdminClient(), ai: getAiRouter(), now: () => new Date(), config: jobConfigFromEnv(process.env) };
}

export function runWorker(opts: { userId?: string; budgetMs: number; concurrency?: number }) {
  return processJobs(jobContext(), opts);
}
