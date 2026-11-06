import type { Database, Json } from "@/lib/database.types";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { AiGenerator } from "@/lib/ai/preference";

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

export type JobConfig = {
  /** Au-delà de ce coût estimé, la génération d'un document attend une confirmation. */
  confirmThresholdUsd: number;
  /** Hypothèse de prix pour l'estimation (la plus chère des deux, par prudence). */
  models: { main: string; light: string; reasoningFactor?: number };
};

export type JobContext = { db: AdminSupabase; ai: AiGenerator; now: () => Date; config: JobConfig };

export function jobConfigFromEnv(e: Record<string, string | undefined>): JobConfig {
  const mock = e.AI_PRIMARY_PROVIDER === "mock";
  const meta = e.META_MODEL ?? "muse-spark-1.3-contributor";
  return {
    confirmThresholdUsd: Number(e.AI_CONFIRM_THRESHOLD_USD ?? 0.3),
    // Meta (fournisseur par défaut) raisonne toujours : sa sortie compte ~2,5 fois plus de tokens.
    models: mock ? { main: "mock", light: "mock" } : { main: meta, light: meta, reasoningFactor: 2.5 },
  };
}

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
