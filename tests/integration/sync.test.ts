import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { applyEvents } from "@/lib/review/apply";
import { createSession, loadSessionCards } from "@/lib/review/sessions";
import type { SessionItem } from "@/lib/review/build";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../helpers/supabase";
import { seedDeck } from "../helpers/seed";
import type { ServerSupabase } from "@/lib/supabase/server";

let u: TestUser;
let deck: Awaited<ReturnType<typeof seedDeck>>;
let db: ServerSupabase;
const at = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

beforeAll(async () => {
  u = await createTestUser("sync");
  deck = await seedDeck(adminClient(), u.id);
  db = u.client as unknown as ServerSupabase;
});
afterAll(() => deleteTestUser(u));

describe("sessions et synchronisation", () => {
  let sessionId: string;
  let items: SessionItem[];

  it("« Réviser maintenant » : session de nouvelles notions, fiche d'abord", async () => {
    sessionId = (await createSession(db, u.id, { mode: "mix", minutes: 10 }))!;
    expect(sessionId).toBeTruthy();
    const { data } = await db.from("study_sessions").select("items, position, status").eq("id", sessionId).single();
    items = data!.items as SessionItem[];
    expect(items[0]!.type).toBe("fiche");
    expect(data!.status).toBe("active");
    const cards = await loadSessionCards(db, items);
    expect(cards).toHaveLength(items.length);
    expect(cards[0]!.notionTitle).toBe("Notion 1");
  });

  it("une réponse met à jour FSRS ; la renvoyer ne crée aucun doublon", async () => {
    const card = deck.cards.find((c) => c.type === "flashcard")!;
    const ev = {
      kind: "review" as const,
      id: randomUUID(),
      cardId: card.id,
      sessionId,
      outcome: "rated" as const,
      rating: 3,
      correct: true,
      at: at(),
    };
    const r1 = await applyEvents(db, u.id, [ev]);
    const r2 = await applyEvents(db, u.id, [ev]);
    expect(r1.applied).toContain(ev.id);
    expect(r2.skipped).toContain(ev.id);
    const { data: reviews } = await db.from("reviews").select("id").eq("card_id", card.id);
    expect(reviews).toHaveLength(1);
    const { data: st } = await db.from("card_states").select("reps, state").eq("card_id", card.id).single();
    expect(st!.reps).toBe(1);
  });

  it("« J'étais absent » ne touche jamais FSRS", async () => {
    const card = deck.cards.find((c) => c.type === "qcm")!;
    await applyEvents(db, u.id, [
      {
        kind: "review",
        id: randomUUID(),
        cardId: card.id,
        sessionId,
        outcome: "absent",
        rating: null,
        correct: null,
        at: at(),
      },
    ]);
    const { data: st } = await db.from("card_states").select("card_id").eq("card_id", card.id);
    expect(st).toEqual([]);
  });

  it("« J'ai décroché » annule une erreur : elle ne compte pas et l'état FSRS est restauré", async () => {
    const card = deck.cards.find((c) => c.type === "vrai_faux")!;
    const good = randomUUID();
    const bad = randomUUID();
    await applyEvents(db, u.id, [
      {
        kind: "review",
        id: good,
        cardId: card.id,
        sessionId,
        outcome: "rated",
        rating: 3,
        correct: true,
        at: at(-60_000),
      },
    ]);
    const { data: before } = await db.from("card_states").select("*").eq("card_id", card.id).single();
    await applyEvents(db, u.id, [
      {
        kind: "review",
        id: bad,
        cardId: card.id,
        sessionId,
        outcome: "rated",
        rating: 1,
        correct: false,
        at: at(-1000),
      },
    ]);
    const { data: wrong } = await db.from("card_states").select("lapses, due").eq("card_id", card.id).single();
    expect(wrong!.due).not.toBe(before!.due);
    await applyEvents(db, u.id, [{ kind: "undo", id: randomUUID(), reviewId: bad, at: at() }]);
    const { data: after } = await db.from("card_states").select("*").eq("card_id", card.id).single();
    expect(after!.due).toBe(before!.due);
    expect(after!.reps).toBe(before!.reps);
    const { data: rev } = await db.from("reviews").select("outcome, rating, undone").eq("id", bad).single();
    expect(rev).toEqual({ outcome: "absent", rating: null, undone: true });
  });

  it("position sauvegardée, idées notées, fin de session et série", async () => {
    await applyEvents(db, u.id, [
      { kind: "position", id: randomUUID(), sessionId, position: 3, at: at() },
      { kind: "parking", id: randomUUID(), sessionId, text: "Revoir les jointures", at: at() },
      { kind: "session_event", id: randomUUID(), sessionId, type: "decroche", cardId: null, at: at() },
    ]);
    const { data: s } = await db.from("study_sessions").select("position").eq("id", sessionId).single();
    expect(s!.position).toBe(3);
    const { data: p } = await db.from("parking").select("text").eq("user_id", u.id);
    expect(p!.map((x) => x.text)).toContain("Revoir les jointures");
    await applyEvents(db, u.id, [
      { kind: "session_end", id: randomUUID(), sessionId, stats: { answered: 2, correct: 1, decroches: 1 }, at: at() },
    ]);
    const { data: prof } = await db.from("profiles").select("streak").eq("user_id", u.id).single();
    expect((prof!.streak as { current: number }).current).toBe(1);
    const { data: done } = await db.from("study_sessions").select("status").eq("id", sessionId).single();
    expect(done!.status).toBe("done");
  });

  it("les cartes révisées deviennent dues et reviennent dans une session « mélange »", async () => {
    await adminClient()
      .from("card_states")
      .update({ due: new Date(Date.now() - 3600_000).toISOString() })
      .eq("user_id", u.id);
    const id = await createSession(db, u.id, { mode: "flashcards", minutes: 5 });
    const { data } = await db.from("study_sessions").select("items").eq("id", id!).single();
    expect((data!.items as SessionItem[]).every((i) => ["flashcard", "vocab", "phrase"].includes(i.type))).toBe(true);
  });

  it("mode notion : toutes les cartes de la notion, fiche en premier", async () => {
    const id = await createSession(db, u.id, { mode: "notion", minutes: 10, notionId: deck.notions[2] });
    const { data } = await db.from("study_sessions").select("items").eq("id", id!).single();
    const types = (data!.items as SessionItem[]).map((i) => i.type);
    expect(types[0]).toBe("fiche");
    expect(types).toHaveLength(4);
  });

  it("un autre utilisateur ne peut pas synchroniser sur mes cartes", async () => {
    const other = await createTestUser("intrus");
    try {
      await expect(
        applyEvents(other.client as unknown as ServerSupabase, other.id, [
          {
            kind: "review",
            id: randomUUID(),
            cardId: deck.cards[0]!.id,
            sessionId: null,
            outcome: "rated",
            rating: 1,
            correct: false,
            at: at(),
          },
        ]),
      ).rejects.toBeTruthy();
    } finally {
      await deleteTestUser(other);
    }
  });
});
