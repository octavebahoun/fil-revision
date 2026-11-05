"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { getAiRouter } from "@/lib/ai/server";
import { AiError } from "@/lib/ai/types";
import { FeedbackOutput, GuideOutput, buildFeedbackPrompt, mockFeedback } from "@/lib/ai/tasks/exercise";

/** Révèle l'indice suivant (1, puis 2, puis 3) et le mémorise. */
export async function revealHintAction(guideId: string, stepIndex: number): Promise<number> {
  const { user, supabase } = await requireUser();
  const gid = z.uuid().parse(guideId);
  const idx = z.number().int().min(0).max(10).parse(stepIndex);
  const { data: cur } = await supabase
    .from("exercise_progress")
    .select("hints_shown")
    .eq("guide_id", gid)
    .eq("step_index", idx)
    .maybeSingle();
  const next = Math.min(3, (cur?.hints_shown ?? 0) + 1);
  await supabase
    .from("exercise_progress")
    .upsert(
      { user_id: user.id, guide_id: gid, step_index: idx, hints_shown: next, updated_at: new Date().toISOString() },
      { onConflict: "guide_id,step_index" },
    );
  return next;
}

export type StepFeedback = { ok: true; result: FeedbackOutput } | { ok: false; message: string };

/** Commente ma réponse à une étape (5 lignes, jamais la solution complète). */
export async function stepFeedbackAction(guideId: string, stepIndex: number, answer: string): Promise<StepFeedback> {
  const { user, supabase } = await requireUser();
  const text = answer.trim();
  if (text.length < 5) return { ok: false, message: "Écris d'abord une réponse, même courte." };
  if (text.length > 4000) return { ok: false, message: "Réponse trop longue (4 000 caractères max)." };
  if (!(await rateLimit("ai", user.id))) return { ok: false, message: "Petite pause : réessaie dans une minute." };
  const { data: guide } = await supabase
    .from("exercise_guides")
    .select("id, steps, document_id")
    .eq("id", z.uuid().parse(guideId))
    .maybeSingle();
  if (!guide) return { ok: false, message: "Exercice introuvable." };
  const parsed = GuideOutput.safeParse(guide.steps);
  const step = parsed.success ? parsed.data.steps[stepIndex] : undefined;
  if (!step) return { ok: false, message: "Étape introuvable." };
  const { data: pages } = await supabase
    .from("document_pages")
    .select("text")
    .eq("document_id", guide.document_id)
    .order("page_number");
  const statement = (pages ?? []).map((p) => p.text).join("\n\n");
  try {
    const prompt = buildFeedbackPrompt({ statement, step, answer: text });
    const { data } = await getAiRouter().generate({
      userId: user.id,
      purpose: "exercise_feedback",
      tier: "light",
      schema: FeedbackOutput,
      system: prompt.system,
      user: prompt.user,
      maxTokens: 5000,
      temperature: 0.3,
      mock: () => mockFeedback(text),
    });
    await supabase.from("exercise_progress").upsert(
      {
        user_id: user.id,
        guide_id: guide.id,
        step_index: stepIndex,
        answer: text,
        feedback: data,
        done: data.status === "ok",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guide_id,step_index" },
    );
    return { ok: true, result: data };
  } catch (err) {
    if (err instanceof AiError && err.code === "budget")
      return { ok: false, message: "Le budget IA du jour est atteint. Réessaie demain." };
    return { ok: false, message: "Je n'ai pas pu commenter ta réponse. Réessaie dans un instant." };
  }
}
