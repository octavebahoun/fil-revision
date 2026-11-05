import { describe, expect, it } from "vitest";
import { planCountdown, remainingMinutes } from "@/lib/review/planning";

describe("planning à rebours", () => {
  it("répartit le travail jusqu'à la veille de l'examen", () => {
    const days = planCountdown({
      today: "2026-11-05",
      exams: [{ subjectId: "uml", date: "2026-11-15" }],
      remaining: { uml: 200 },
      capMinutes: 60,
    });
    expect(days).toHaveLength(10);
    expect(days.reduce((s, d) => s + d.total, 0)).toBe(200);
    expect(Math.max(...days.map((d) => d.total))).toBeLessThanOrEqual(21);
  });
  it("respecte le plafond quotidien, examen le plus proche d'abord", () => {
    const days = planCountdown({
      today: "2026-11-05",
      exams: [
        { subjectId: "a", date: "2026-11-08" },
        { subjectId: "b", date: "2026-11-20" },
      ],
      remaining: { a: 120, b: 300 },
      capMinutes: 45,
    });
    expect(days.every((d) => d.total <= 45)).toBe(true);
    expect(days[0]!.bySubject.a).toBe(40);
  });
  it("après un jour sauté : rattrapage progressif, jamais d'un coup", () => {
    const before = planCountdown({
      today: "2026-11-05",
      exams: [{ subjectId: "x", date: "2026-11-15" }],
      remaining: { x: 200 },
      capMinutes: 90,
    });
    // Le 5 est sauté : le lendemain, il reste toujours 200 min, mais la charge est lissée.
    const after = planCountdown({
      today: "2026-11-06",
      exams: [{ subjectId: "x", date: "2026-11-15" }],
      remaining: { x: 200 },
      capMinutes: 90,
      previousDaily: before[0]!.total,
    });
    expect(after[0]!.total).toBeLessThanOrEqual(Math.ceil(before[0]!.total * 1.25));
    expect(after[0]!.total).toBeGreaterThan(before[0]!.total);
    expect(after.reduce((s, d) => s + d.total, 0)).toBe(200);
  });
  it("rien si pas d'examen à venir", () => {
    expect(
      planCountdown({
        today: "2026-11-05",
        exams: [{ subjectId: "x", date: "2026-11-05" }],
        remaining: { x: 10 },
        capMinutes: 30,
      }),
    ).toEqual([]);
  });
  it("estimation du travail restant", () => {
    expect(remainingMinutes({ newNotions: 10, unmasteredCards: 50 })).toBe(50);
  });
});
