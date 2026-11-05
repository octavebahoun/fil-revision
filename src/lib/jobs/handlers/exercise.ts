import type { Json } from "@/lib/database.types";
import { GuideOutput, buildGuidePrompt, mockGuide } from "@/lib/ai/tasks/exercise";
import { AiError } from "@/lib/ai/types";
import { JobFatal, type JobHandler } from "../types";

type Payload = { documentId: string };

/** Énoncé d'exercice : aide guidée en étapes avec indices progressifs, jamais de corrigé. */
export const exerciseGuideHandler: JobHandler = {
  async run(job, ctx) {
    const { documentId } = job.payload as Payload;
    const { data: doc } = await ctx.db
      .from("documents")
      .select("id, title")
      .eq("id", documentId)
      .eq("user_id", job.user_id)
      .maybeSingle();
    if (!doc) throw new JobFatal("Document introuvable.");
    const { data: pages } = await ctx.db
      .from("document_pages")
      .select("text")
      .eq("document_id", doc.id)
      .order("page_number");
    const statement = (pages ?? []).map((p) => p.text).join("\n\n");
    let guide: GuideOutput;
    try {
      const prompt = buildGuidePrompt(statement, doc.title);
      const res = await ctx.ai.generate({
        userId: job.user_id,
        purpose: "exercise_guide",
        schema: GuideOutput,
        system: prompt.system,
        user: prompt.user,
        maxTokens: 6000,
        reasoning: "off",
        cacheKey: `guide:v1:${documentId}`,
        mock: () => mockGuide(statement),
      });
      guide = res.data;
    } catch (err) {
      if (err instanceof AiError && err.code === "schema")
        throw new JobFatal("L'aide guidée n'a pas pu être préparée.");
      throw err;
    }
    const { error } = await ctx.db
      .from("exercise_guides")
      .upsert(
        { user_id: job.user_id, document_id: doc.id, steps: guide as unknown as { [k: string]: Json } },
        { onConflict: "document_id" },
      );
    if (error) throw error;
    await ctx.db.from("documents").update({ status: "ready" }).eq("id", doc.id);
    return { kind: "done" };
  },
  async onFail(job, ctx, message) {
    const { documentId } = job.payload as Payload;
    await ctx.db
      .from("documents")
      .update({ status: "error", error_message: message })
      .eq("id", documentId)
      .eq("user_id", job.user_id);
  },
};
