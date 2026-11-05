import { describe, expect, it } from "vitest";
import { applyRating, ratingFromCorrect, toCard } from "@/lib/review/fsrs";
import { buildSession, type CardLite, type NewNotion } from "@/lib/review/build";
import { displayStreak, updateStreak, parisDay } from "@/lib/review/streak";
import {
  associationCorrect,
  blanksCorrect,
  orderCorrect,
  seededShuffle,
  shortAnswerCorrect,
} from "@/lib/review/answer";
import { SyncBody } from "@/lib/review/events";

const t0 = new Date("2026-11-05T09:00:00Z");

describe("FSRS", () => {
  it("une bonne réponse repousse la carte, une erreur la rapproche", () => {
    const good = applyRating(null, 3, t0);
    const again = applyRating(null, 1, t0);
    expect(new Date(good.due).getTime()).toBeGreaterThan(new Date(again.due).getTime());
    expect(good.reps).toBe(1);
  });
  it("Facile > Bien > Difficile en intervalle", () => {
    let s = applyRating(null, 3, t0);
    const later = new Date(new Date(s.due).getTime() + 86_400_000);
    s = applyRating(s, 3, later);
    const easy = applyRating(s, 4, new Date(new Date(s.due).getTime()));
    const hard = applyRating(s, 2, new Date(new Date(s.due).getTime()));
    expect(easy.scheduled_days).toBeGreaterThan(hard.scheduled_days);
  });
  it("conversion état ↔ carte", () => {
    expect(toCard(null, t0).reps).toBe(0);
    expect(ratingFromCorrect(true)).toBe(3);
    expect(ratingFromCorrect(false)).toBe(1);
  });
});

const card = (id: string, type = "flashcard", notion = "n"): CardLite => ({
  cardId: id,
  type,
  notionId: notion,
  subjectId: "s",
});
const notion = (id: string): NewNotion => ({
  notionId: id,
  subjectId: "s",
  ficheId: `${id}-fiche`,
  cards: [
    card(`${id}-f1`, "flashcard", id),
    card(`${id}-q1`, "qcm", id),
    card(`${id}-q2`, "vrai_faux", id),
    card(`${id}-q3`, "ordre", id),
  ],
});

describe("construction de session", () => {
  it("10 min : cartes dues et nouvelles notions entrelacées, fiche avant ses cartes", () => {
    const items = buildSession({
      mode: "mix",
      minutes: 10,
      due: Array.from({ length: 30 }, (_, i) => card(`d${i}`)),
      fresh: [notion("a"), notion("b")],
    });
    const total = items.reduce(
      (s, i) => s + ({ fiche: 45, flashcard: 15, qcm: 25, vrai_faux: 20 } as Record<string, number>)[i.type]!,
      0,
    );
    expect(total).toBeLessThanOrEqual(600);
    const fi = items.findIndex((i) => i.cardId === "a-fiche");
    const qi = items.findIndex((i) => i.cardId === "a-q1");
    expect(fi).toBeGreaterThanOrEqual(0);
    expect(fi).toBeLessThan(qi);
    expect(items.some((i) => i.cardId.startsWith("d"))).toBe(true);
  });
  it("sans nouveauté : uniquement des cartes dues", () => {
    const items = buildSession({
      mode: "mix",
      minutes: 5,
      due: Array.from({ length: 50 }, (_, i) => card(`d${i}`)),
      fresh: [],
    });
    expect(items).toHaveLength(20);
  });
  it("rien à réviser : session vide", () => {
    expect(buildSession({ mode: "mix", minutes: 10, due: [], fresh: [] })).toEqual([]);
  });
  it("modes ciblés : quiz uniquement / fiches uniquement", () => {
    const due = [card("d1", "qcm"), card("d2", "flashcard")];
    expect(buildSession({ mode: "quiz", minutes: 10, due, fresh: [] }).map((i) => i.type)).toEqual(["qcm"]);
    expect(buildSession({ mode: "fiches", minutes: 10, due, fresh: [notion("a")] }).map((i) => i.type)).toEqual([
      "fiche",
    ]);
  });
  it("mode Fatigué : 5 min de cartes faciles connues", () => {
    const easy = Array.from({ length: 40 }, (_, i) => card(`e${i}`));
    const items = buildSession({ mode: "fatigue", minutes: 5, due: [], fresh: [], easy });
    expect(items.length).toBe(20);
    expect(items.every((i) => !i.fresh)).toBe(true);
  });
});

describe("série avec jokers, sans culpabilité", () => {
  const s0 = { current: 0, best: 0, jokers: 1, lastDay: null };
  it("démarre, continue le lendemain", () => {
    const a = updateStreak(s0, "2026-11-01");
    expect(a.current).toBe(1);
    expect(updateStreak(a, "2026-11-02").current).toBe(2);
    expect(updateStreak(a, "2026-11-01").current).toBe(1);
  });
  it("un jour manqué consomme un joker automatiquement", () => {
    const a = { current: 5, best: 5, jokers: 1, lastDay: "2026-11-01" };
    const b = updateStreak(a, "2026-11-03");
    expect(b).toMatchObject({ current: 6, jokers: 0, usedJokers: 1 });
  });
  it("sans joker, la série repart de 1 (meilleure série gardée)", () => {
    const b = updateStreak({ current: 9, best: 9, jokers: 0, lastDay: "2026-11-01" }, "2026-11-05");
    expect(b).toMatchObject({ current: 1, best: 9 });
  });
  it("un joker gagné tous les 7 jours, 3 au maximum", () => {
    expect(updateStreak({ current: 6, best: 6, jokers: 1, lastDay: "2026-11-01" }, "2026-11-02")).toMatchObject({
      current: 7,
      jokers: 2,
      earnedJoker: true,
    });
    expect(updateStreak({ current: 13, best: 13, jokers: 3, lastDay: "2026-11-01" }, "2026-11-02").jokers).toBe(3);
  });
  it("affichage du jour", () => {
    expect(displayStreak({ current: 4, best: 4, jokers: 0, lastDay: "2026-11-04" }, "2026-11-05")).toBe(4);
    expect(displayStreak({ current: 4, best: 4, jokers: 1, lastDay: "2026-11-03" }, "2026-11-05")).toBe(4);
    expect(displayStreak({ current: 4, best: 4, jokers: 0, lastDay: "2026-11-01" }, "2026-11-05")).toBe(0);
    expect(displayStreak({ current: 0, best: 0, jokers: 1, lastDay: null }, "2026-11-05")).toBe(0);
    expect(parisDay(new Date("2026-11-05T23:30:00Z"))).toBe("2026-11-06");
  });
});

describe("correction bienveillante", () => {
  it("réponse courte : accents, casse, article et petite faute", () => {
    expect(shortAnswerCorrect("Clé primaire", ["clé primaire"])).toBe(true);
    expect(shortAnswerCorrect("la cle primaire", ["clé primaire"])).toBe(true);
    expect(shortAnswerCorrect("clé primiare", ["clé primaire"])).toBe(true);
    expect(shortAnswerCorrect("clé étrangère", ["clé primaire"])).toBe(false);
    expect(shortAnswerCorrect("", ["x"])).toBe(false);
    expect(shortAnswerCorrect("GET", ["get"])).toBe(true);
    expect(shortAnswerCorrect("PUT", ["get"])).toBe(false);
  });
  it("trous, ordre, association", () => {
    expect(blanksCorrect(["select", "From"], ["SELECT", "FROM"])).toBe(true);
    expect(blanksCorrect(["select"], ["SELECT", "FROM"])).toBe(false);
    expect(orderCorrect(["a", "b"], ["a", "b"])).toBe(true);
    expect(orderCorrect(["b", "a"], ["a", "b"])).toBe(false);
    expect(
      associationCorrect({ A: "1", B: "2" }, [
        { left: "A", right: "1" },
        { left: "B", right: "2" },
      ]),
    ).toBe(true);
    expect(
      associationCorrect({ A: "2", B: "1" }, [
        { left: "A", right: "1" },
        { left: "B", right: "2" },
      ]),
    ).toBe(false);
  });
  it("mélange déterministe et jamais identique à la solution", () => {
    const items = ["a", "b", "c", "d"];
    expect(seededShuffle(items, "x")).toEqual(seededShuffle(items, "x"));
    expect(seededShuffle(items, "x")).not.toEqual(items);
    expect([...seededShuffle(items, "y")].sort()).toEqual(items);
  });
});

describe("événements de synchronisation", () => {
  it("valide et refuse les formats", () => {
    const ok = SyncBody.safeParse({
      events: [
        {
          kind: "review",
          id: crypto.randomUUID(),
          cardId: crypto.randomUUID(),
          sessionId: null,
          outcome: "absent",
          rating: null,
          correct: null,
          at: t0.toISOString(),
        },
      ],
    });
    expect(ok.success).toBe(true);
    expect(SyncBody.safeParse({ events: [] }).success).toBe(false);
    expect(SyncBody.safeParse({ events: [{ kind: "pirate" }] }).success).toBe(false);
  });
});
