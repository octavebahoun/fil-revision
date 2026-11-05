import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiRouter } from "@/lib/ai/server";
import { processJobs } from "./worker";
import type { JobContext } from "./types";

export function jobContext(): JobContext {
  return { db: createAdminClient(), ai: getAiRouter(), now: () => new Date() };
}

export function runWorker(opts: { userId?: string; budgetMs: number; concurrency?: number }) {
  return processJobs(jobContext(), opts);
}
