"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { getAiRouter } from "@/lib/ai/server";
import { AiError } from "@/lib/ai/types";
import { FeynmanOutput, buildFeynmanPrompt, mockFeynman } from "@/lib/ai/tasks/feynman";

export type FeynmanResult = { ok: true; result: FeynmanOutput } | { ok: false; message: string };

/** Évalue l'explication de l'étudiant face au cours (5 lignes au plus). */
export async function evaluateFeynmanAction(notionId: string, explanation: string): Promise<FeynmanResult> {
  const { user, supabase } = await requireUser();
  const text = explanation.trim();
  if (text.length < 15) return { ok: false, message: "Écris ou dicte au moins une phrase complète." };
  if (text.length > 3000)
    return { ok: false, message: "C'est un peu long : garde l'essentiel (3 000 caractères max)." };
  if (!(await rateLimit("ai", user.id))) return { ok: false, message: "Petite pause : réessaie dans une minute." };
  const { data: n } = await supabase
    .from("notions")
    .select("id, title, source_text")
    .eq("id", z.uuid().parse(notionId))
    .maybeSingle();
  if (!n) return { ok: false, message: "Notion introuvable." };
  try {
    const prompt = buildFeynmanPrompt({ title: n.title, explanation: text, sourceText: n.source_text });
    const { data } = await getAiRouter().generate({
      userId: user.id,
      purpose: "feynman",
      tier: "light",
      schema: FeynmanOutput,
      system: prompt.system,
      user: prompt.user,
      maxTokens: 6000,
      temperature: 0.2,
      mock: () => mockFeynman({ explanation: text, sourceText: n.source_text }),
    });
    await supabase
      .from("feynman_attempts")
      .insert({ user_id: user.id, notion_id: n.id, explanation: text, feedback: data });
    return { ok: true, result: data };
  } catch (err) {
    if (err instanceof AiError && err.code === "budget")
      return { ok: false, message: "Le budget IA du jour est atteint. Réessaie demain." };
    return { ok: false, message: "Je n'ai pas pu analyser ton explication. Réessaie dans un instant." };
  }
}
