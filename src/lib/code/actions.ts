"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { getAiRouter } from "@/lib/ai/server";
import { AiError } from "@/lib/ai/types";
import { quoteSupported } from "@/lib/text/normalize";
import { CodeExerciseContent } from "@/lib/content/schemas";
import {
  CodeExerciseOutput,
  PhpReview,
  buildCodePrompt,
  buildPhpReviewPrompt,
  mockCode,
  mockPhpReview,
  pickLanguage,
} from "@/lib/ai/tasks/code";

/** Crée (une fois) un exercice de code pour une notion, à la demande. */
export async function createCodeExerciseAction(
  notionId: string,
): Promise<{ ok: true; cardId: string } | { ok: false; message: string }> {
  const { user, supabase } = await requireUser();
  const id = z.uuid().parse(notionId);
  const { data: existing } = await supabase
    .from("cards")
    .select("id")
    .eq("notion_id", id)
    .eq("type", "code_exercise")
    .eq("status", "active")
    .maybeSingle();
  if (existing) return { ok: true, cardId: existing.id };
  const { data: n } = await supabase
    .from("notions")
    .select("id, title, source_text, subject_id, document_id, pages, subjects(name)")
    .eq("id", id)
    .maybeSingle();
  if (!n) return { ok: false, message: "Notion introuvable." };
  const language = pickLanguage((n.subjects as unknown as { name: string }).name, n.source_text);
  if (!language) return { ok: false, message: "Cette notion ne se prête pas à un exercice de code." };
  if (!(await rateLimit("aiHeavy", user.id)))
    return { ok: false, message: "Petite pause : réessaie dans quelques minutes." };
  try {
    const prompt = buildCodePrompt({ title: n.title, sourceText: n.source_text, language });
    const { data } = await getAiRouter().generate({
      userId: user.id,
      purpose: "code_exercise",
      schema: CodeExerciseOutput,
      system: prompt.system,
      user: prompt.user,
      maxTokens: 5000,
      reasoning: "off",
      mock: () => mockCode({ title: n.title, sourceText: n.source_text, language }),
    });
    const { sourceQuote, ...content } = data.exercise;
    if (!quoteSupported(sourceQuote, n.source_text))
      return { ok: false, message: "L'exercice proposé ne s'appuyait pas assez sur le cours. Réessaie." };
    const { data: card, error } = await supabase
      .from("cards")
      .insert({
        user_id: user.id,
        notion_id: n.id,
        subject_id: n.subject_id,
        document_id: n.document_id,
        type: "code_exercise",
        content: { ...content, language },
        source_pages: n.pages.slice(0, 3),
        source_quote: sourceQuote,
        verified: true,
      })
      .select("id")
      .single();
    if (error || !card) return { ok: false, message: "Enregistrement impossible." };
    return { ok: true, cardId: card.id };
  } catch (err) {
    if (err instanceof AiError && err.code === "budget")
      return { ok: false, message: "Le budget IA du jour est atteint. Réessaie demain." };
    return { ok: false, message: "L'exercice n'a pas pu être créé. Réessaie dans un instant." };
  }
}

/** Relecture d'un code PHP par l'IA (jamais exécuté sur le serveur). */
export async function reviewPhpAction(
  cardId: string,
  code: string,
): Promise<{ ok: true; review: PhpReview } | { ok: false; message: string }> {
  const { user, supabase } = await requireUser();
  if (code.trim().length < 5 || code.length > 4000)
    return { ok: false, message: "Écris un peu de code (4 000 caractères max)." };
  if (!(await rateLimit("ai", user.id))) return { ok: false, message: "Petite pause : réessaie dans une minute." };
  const { data: card } = await supabase
    .from("cards")
    .select("content")
    .eq("id", z.uuid().parse(cardId))
    .eq("type", "code_exercise")
    .maybeSingle();
  const ex = card ? CodeExerciseContent.safeParse(card.content) : null;
  if (!ex?.success) return { ok: false, message: "Exercice introuvable." };
  try {
    const prompt = buildPhpReviewPrompt({ prompt: ex.data.prompt, expectedOutput: ex.data.expectedOutput, code });
    const { data } = await getAiRouter().generate({
      userId: user.id,
      purpose: "code_exercise",
      tier: "light",
      schema: PhpReview,
      system: prompt.system,
      user: prompt.user,
      maxTokens: 5000,
      mock: () => mockPhpReview(code, ex.data.expectedOutput),
    });
    return { ok: true, review: data };
  } catch {
    return { ok: false, message: "La relecture n'a pas abouti. Réessaie dans un instant." };
  }
}
