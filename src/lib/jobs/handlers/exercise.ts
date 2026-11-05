import { JobFatal, type JobHandler } from "../types";

/** Implémenté dans une phase ultérieure. */
export const exerciseGuideHandler: JobHandler = {
  async run() {
    throw new JobFatal("Fonction pas encore disponible.");
  },
  async onFail(job, ctx) {
    const { documentId } = job.payload as { documentId: string };
    await ctx.db.from("documents").update({ status: "ready" }).eq("id", documentId).eq("user_id", job.user_id);
  },
};
