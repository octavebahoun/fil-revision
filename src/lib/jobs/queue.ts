import type { Json } from "@/lib/database.types";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { JobType } from "./types";

/** Ajoute un job (idempotent grâce à dedupeKey : un job identique n'est jamais créé deux fois). */
export async function enqueueJob(
  db: AdminSupabase,
  job: { userId: string; type: JobType; payload: Record<string, Json>; dedupeKey: string; total?: number },
): Promise<void> {
  const { error } = await db.from("jobs").upsert(
    {
      user_id: job.userId,
      type: job.type,
      payload: job.payload,
      dedupe_key: job.dedupeKey,
      total: job.total ?? 0,
      status: "queued",
    },
    { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
  );
  if (error) throw error;
}

/** Relance un job existant (ex. réimport d'un fichier en erreur). */
export async function requeueJob(db: AdminSupabase, userId: string, dedupeKey: string): Promise<void> {
  await db
    .from("jobs")
    .update({
      status: "queued",
      step: "start",
      attempts: 0,
      run_after: new Date().toISOString(),
      last_error: null,
      locked_until: null,
    })
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .in("status", ["error", "done", "cancelled"]);
}
