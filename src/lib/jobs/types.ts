import type { Database, Json } from "@/lib/database.types";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { AiRouter } from "@/lib/ai/router";

export type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
export type JobType = JobRow["type"];

export type StepResult =
  | {
      kind: "continue";
      step: string;
      payload?: Record<string, Json | undefined>;
      progress?: number;
      total?: number;
      runAfter?: Date;
    }
  | { kind: "done"; progress?: number; total?: number }
  | { kind: "fail"; message: string };

export type JobContext = { db: AdminSupabase; ai: AiRouter; now: () => Date };

export type JobHandler = {
  run(job: JobRow, ctx: JobContext): Promise<StepResult>;
  /** Appelé quand le job échoue définitivement (mettre à jour le document / la notion). */
  onFail?(job: JobRow, ctx: JobContext, message: string): Promise<void>;
};

/** Erreur définitive avec un message lisible pour l'utilisateur (pas de nouvelle tentative). */
export class JobFatal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobFatal";
  }
}
