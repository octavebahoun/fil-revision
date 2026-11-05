import { describe, expect, it } from "vitest";
import { dueReminders, parisClock, reminderMessage } from "@/lib/push/reminders";

const base = { userId: "u", enabled: true, time: "18:30", lastReminderOn: null };

describe("rappels à l'heure choisie", () => {
  it("heure de Paris (hiver : UTC+1)", () => {
    expect(parisClock(new Date("2026-11-05T17:30:00Z"))).toEqual({ day: "2026-11-05", minutes: 18 * 60 + 30 });
  });
  it("part à l'heure prévue (fenêtre de 15 min), pas avant, pas après", () => {
    expect(dueReminders([base], new Date("2026-11-05T17:29:00Z"))).toHaveLength(0);
    expect(dueReminders([base], new Date("2026-11-05T17:30:00Z"))).toHaveLength(1);
    expect(dueReminders([base], new Date("2026-11-05T17:40:00Z"))).toHaveLength(1);
    expect(dueReminders([base], new Date("2026-11-05T17:46:00Z"))).toHaveLength(0);
  });
  it("un seul rappel par jour, et jamais si désactivé", () => {
    expect(dueReminders([{ ...base, lastReminderOn: "2026-11-05" }], new Date("2026-11-05T17:31:00Z"))).toHaveLength(0);
    expect(dueReminders([{ ...base, enabled: false }], new Date("2026-11-05T17:31:00Z"))).toHaveLength(0);
  });
  it("message doux, sans reproche", () => {
    const m = reminderMessage("2026-11-05");
    expect(m.body).not.toMatch(/raté|oublié|retard/i);
  });
});
