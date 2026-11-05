import type { Json } from "@/lib/database.types";
import type { CardType } from "@/lib/content/schemas";
import { buildRegeneratePrompt, mockRegenerate, regenerateSchema } from "@/lib/ai/tasks/regenerate";
import { VerifyOutput, buildVerifyPrompt, deterministicCheck, mockVerify } from "@/lib/ai/tasks/verify";
import { AiError } from "@/lib/ai/types";
import { JobFatal, type JobHandler } from "../types";

type Payload = { cardId: string };

/** Carte signalée fausse : régénérée à partir du cours puis vérifiée, ou retirée si rien de vérifiable. */
export const regenerateCardHandler: JobHandler = {
  async run(job, ctx) {
    const { cardId } = job.payload as Payload;
    const { data: card } = await ctx.db
      .from("cards")
      .select("id, type, content, flag_reason, status, notion_id, notions!inner(title, pages, source_text, language)")
      .eq("id", cardId)
      .eq("user_id", job.user_id)
      .maybeSingle();
    if (!card) throw new JobFatal("Carte introuvable.");
    if (card.status !== "flagged") return { kind: "done" };
    const n = card.notions as unknown as { title: string; pages: number[]; source_text: string; language: "fr" | "en" };
    const input = { title: n.title, subject: "", pages: n.pages, sourceText: n.source_text, language: n.language };
    const type = card.type as CardType;
    const remove = async () => {
      await ctx.db.from("cards").update({ status: "removed" }).eq("id", card.id);
      return { kind: "done" as const };
    };

    let item: Record<string, unknown> & { sourceQuote: string; sourcePages: number[] };
    try {
      const prompt = buildRegeneratePrompt(input, type, card.content, card.flag_reason ?? "");
      const { data } = await ctx.ai.generate({
        userId: job.user_id,
        purpose: "regenerate_card",
        schema: regenerateSchema(type),
        system: prompt.system,
        user: prompt.user,
        maxTokens: 4000,
        reasoning: "off",
        mock: () => mockRegenerate(input, type),
      });
      item = data.item as typeof item;
    } catch (err) {
      if (err instanceof AiError && err.code === "schema") return remove();
      throw err;
    }
    const { sourceQuote, sourcePages, ...content } = item;
    const verifiable = [{ id: "c", type, text: JSON.stringify(content), sourceQuote, sourcePages }];
    if (!deterministicCheck(verifiable, n.source_text).kept.length) return remove();
    try {
      const prompt = buildVerifyPrompt(verifiable, n.source_text);
      const { data } = await ctx.ai.generate({
        userId: job.user_id,
        purpose: "verify",
        tier: "light",
        schema: VerifyOutput,
        system: prompt.system,
        user: prompt.user,
        maxTokens: 6000,
        temperature: 0,
        mock: () => mockVerify(verifiable, n.source_text),
      });
      if (data.verdicts.find((v) => v.id === "c")?.supported !== true) return remove();
    } catch (err) {
      if (err instanceof AiError && err.code === "schema") return remove();
      throw err;
    }
    const pages = sourcePages.filter((p) => n.pages.includes(p));
    await ctx.db
      .from("cards")
      .update({
        content: content as { [k: string]: Json },
        source_quote: sourceQuote,
        source_pages: pages.length ? pages : [n.pages[0]!],
        status: "active",
        verified: true,
        edited: false,
        flag_reason: null,
      })
      .eq("id", card.id);
    // La carte corrigée repart de zéro dans la répétition espacée.
    await ctx.db.from("card_states").delete().eq("card_id", card.id);
    return { kind: "done" };
  },
};
