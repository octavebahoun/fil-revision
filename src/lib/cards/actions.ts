"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { CARD_CONTENT, type CardType } from "@/lib/content/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueJob } from "@/lib/jobs/queue";
import { runWorker } from "@/lib/jobs/run";

type Result = { ok: true } | { ok: false; message: string };

export async function updateCardAction(cardId: string, content: unknown): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: card } = await supabase
    .from("cards")
    .select("id, type, notion_id")
    .eq("id", z.uuid().parse(cardId))
    .maybeSingle();
  if (!card) return { ok: false, message: "Carte introuvable." };
  const parsed = CARD_CONTENT[card.type as CardType].safeParse(content);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      message: `À corriger : ${issue?.path.join(" ") || "contenu"} — ${issue?.message ?? "invalide"}.`,
    };
  }
  const { error } = await supabase
    .from("cards")
    .update({ content: parsed.data as never, edited: true, status: "active", flag_reason: null })
    .eq("id", card.id);
  if (error) return { ok: false, message: "Enregistrement impossible. Réessaie." };
  revalidatePath(`/notions/${card.notion_id}`);
  return { ok: true };
}

export async function deleteCardAction(cardId: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("cards")
    .update({ status: "removed" })
    .eq("id", z.uuid().parse(cardId))
    .select("notion_id")
    .maybeSingle();
  if (!data) return { ok: false, message: "Carte introuvable." };
  revalidatePath(`/notions/${data.notion_id}`);
  return { ok: true };
}

/** Signaler une carte fausse : elle sort des révisions, puis est régénérée (ou retirée si rien de vérifiable). */
export async function flagCardAction(cardId: string, reason: string): Promise<Result> {
  const { user, supabase } = await requireUser();
  const clean = reason.trim().slice(0, 500) || "Signalée comme fausse.";
  const { data } = await supabase
    .from("cards")
    .update({ status: "flagged", flag_reason: clean })
    .eq("id", z.uuid().parse(cardId))
    .select("id, notion_id")
    .maybeSingle();
  if (!data) return { ok: false, message: "Carte introuvable." };
  await enqueueJob(createAdminClient(), {
    userId: user.id,
    type: "regenerate_card",
    payload: { cardId: data.id },
    dedupeKey: `regen:${data.id}:${Date.now()}`,
  });
  after(() => runWorker({ userId: user.id, budgetMs: 120_000 }).then(() => undefined));
  revalidatePath(`/notions/${data.notion_id}`);
  return { ok: true };
}
