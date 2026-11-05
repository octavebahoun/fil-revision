/** Régénération des cartes signalées, aide guidée aux exercices, examens blancs (Supabase local, IA simulée). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { processJobs } from "@/lib/jobs/worker";
import { enqueueJob, requeueJob } from "@/lib/jobs/queue";
import { mindmapHandler } from "@/lib/jobs/handlers/mindmap";
import { AiRouter } from "@/lib/ai/router";
import { createMockProvider } from "@/lib/ai/mock";
import { supabaseAiStore } from "@/lib/ai/server";
import { createMockExam, finishMockExam } from "@/lib/review/exam";
import { applyEvents } from "@/lib/review/apply";
import type { SessionItem } from "@/lib/review/build";
import type { ServerSupabase } from "@/lib/supabase/server";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/supabase";
import { seedDeck } from "../helpers/seed";

const db = createAdminClient();
const ctx = {
  db,
  ai: new AiRouter([createMockProvider()], supabaseAiStore, 2),
  now: () => new Date(),
  config: { confirmThresholdUsd: 0.3, models: { main: "mock", light: "mock" } },
};
let u: TestUser;
let deck: Awaited<ReturnType<typeof seedDeck>>;

async function drain() {
  for (let i = 0; i < 20; i++) if ((await processJobs(ctx, { userId: u.id, budgetMs: 30_000 })).idle) return;
}

beforeAll(async () => {
  u = await createTestUser("train");
  deck = await seedDeck(db, u.id, { notions: 3 });
  // Source réaliste pour que la régénération simulée cite un vrai passage.
  await db
    .from("notions")
    .update({
      source_text:
        "[p. 1]\nUne clé primaire identifie de façon unique chaque ligne d'une table. Elle ne peut jamais être nulle.",
    })
    .eq("user_id", u.id);
});
afterAll(() => deleteTestUser(u));

describe("carte signalée fausse", () => {
  it("est régénérée à partir du cours, vérifiée, et repart de zéro en révision", async () => {
    const card = deck.cards.find((c) => c.type === "flashcard")!;
    await db.from("card_states").insert({ user_id: u.id, card_id: card.id });
    await db.from("cards").update({ status: "flagged", flag_reason: "La réponse est fausse" }).eq("id", card.id);
    await enqueueJob(db, {
      userId: u.id,
      type: "regenerate_card",
      payload: { cardId: card.id },
      dedupeKey: `regen:${card.id}`,
    });
    await drain();
    const { data } = await db.from("cards").select("status, verified, flag_reason, content").eq("id", card.id).single();
    expect(data).toMatchObject({ status: "active", verified: true, flag_reason: null });
    expect(JSON.stringify(data!.content)).toContain("clé primaire");
    const { data: st } = await db.from("card_states").select("card_id").eq("card_id", card.id);
    expect(st).toEqual([]);
  });

  it("est retirée si rien de vérifiable ne peut être produit", async () => {
    const card = deck.cards.find((c) => c.type === "qcm")!;
    await db.from("notions").update({ source_text: "[p. 1]\nCourt." }).eq("id", card.notionId);
    await db.from("cards").update({ status: "flagged" }).eq("id", card.id);
    await enqueueJob(db, {
      userId: u.id,
      type: "regenerate_card",
      payload: { cardId: card.id },
      dedupeKey: `regen2:${card.id}`,
    });
    await drain();
    const { data } = await db.from("cards").select("status").eq("id", card.id).single();
    expect(data!.status).toBe("removed");
  });
});

describe("aide guidée aux énoncés d'exercice", () => {
  it("prépare des étapes avec indices, sans corrigé, et marque l'énoncé prêt", async () => {
    await db.from("documents").update({ kind: "exercice", status: "generating" }).eq("id", deck.documentId);
    await db
      .from("document_pages")
      .update({
        text: "Contexte de l'exercice : une agence web. Travail à faire : analyser le besoin du client. Livrable : un planning.",
      })
      .eq("document_id", deck.documentId);
    await enqueueJob(db, {
      userId: u.id,
      type: "exercise_guide",
      payload: { documentId: deck.documentId },
      dedupeKey: `guide:${deck.documentId}`,
    });
    await drain();
    const { data: guide } = await db
      .from("exercise_guides")
      .select("steps")
      .eq("document_id", deck.documentId)
      .single();
    const steps = (guide!.steps as { steps: { hints: string[] }[] }).steps;
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0]!.hints.length).toBeGreaterThan(0);
    const { data: doc } = await db.from("documents").select("status").eq("id", deck.documentId).single();
    expect(doc!.status).toBe("ready");
    await db.from("documents").update({ kind: "cours" }).eq("id", deck.documentId);
  });

  it("un job peut être relancé, et un type inconnu échoue proprement", async () => {
    await requeueJob(db, u.id, `guide:${deck.documentId}`);
    const { data } = await db.from("jobs").select("status").eq("dedupe_key", `guide:${deck.documentId}`).single();
    expect(data!.status).toBe("queued");
    await drain();
    await expect(mindmapHandler.run({} as never, ctx)).rejects.toThrow();
  });
});

describe("examen blanc", () => {
  it("quiz mixte, puis bilan : notions faibles remises dans les révisions", async () => {
    const userDb = u.client as unknown as ServerSupabase;
    const sessionId = (await createMockExam(userDb, u.id, { subjectId: deck.subjectId, count: 10, timerMinutes: 20 }))!;
    const { data: s } = await userDb.from("study_sessions").select("items, mode, timer").eq("id", sessionId).single();
    const items = s!.items as SessionItem[];
    expect(s!.mode).toBe("exam");
    expect(s!.timer).toEqual({ minutes: 20 });
    expect(items.every((i) => ["qcm", "vrai_faux"].includes(i.type))).toBe(true);
    const [wrong, right] = items;
    const at = new Date().toISOString();
    await applyEvents(userDb, u.id, [
      {
        kind: "review",
        id: randomUUID(),
        cardId: wrong!.cardId,
        sessionId,
        outcome: "rated",
        rating: 1,
        correct: false,
        at,
      },
      {
        kind: "review",
        id: randomUUID(),
        cardId: right!.cardId,
        sessionId,
        outcome: "rated",
        rating: 3,
        correct: true,
        at,
      },
    ]);
    const result = (await finishMockExam(userDb, u.id, sessionId))!;
    expect(result.answered).toBe(2);
    expect(result.correct).toBe(1);
    expect(result.weak.map((w) => w.notionId)).toEqual([wrong!.notionId]);
    const { data: states } = await userDb.from("card_states").select("due").eq("card_id", wrong!.cardId);
    expect(new Date(states![0]!.due).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(await finishMockExam(userDb, u.id, randomUUID())).toBeNull();
  });

  it("pas d'examen blanc sans questions", async () => {
    const userDb = u.client as unknown as ServerSupabase;
    const { data: empty } = await userDb
      .from("subjects")
      .insert({ user_id: u.id, name: "Vide", slug: `vide-${randomUUID().slice(0, 4)}` })
      .select("id")
      .single();
    expect(await createMockExam(userDb, u.id, { subjectId: empty!.id, count: 10, timerMinutes: null })).toBeNull();
  });
});
