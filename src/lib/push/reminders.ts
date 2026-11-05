/** Rappels doux : qui doit recevoir un rappel maintenant ? (fonction pure, testable) */
export type ReminderProfile = {
  userId: string;
  enabled: boolean;
  time: string; // "HH:MM", heure de Paris
  lastReminderOn: string | null; // AAAA-MM-JJ
};

export function parisClock(now: Date): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/**
 * Un rappel part si l'heure choisie est atteinte depuis moins de `windowMinutes`
 * (le planificateur passe toutes les 5 minutes) et qu'aucun rappel n'a été envoyé aujourd'hui.
 */
export function dueReminders(profiles: ReminderProfile[], now: Date, windowMinutes = 15): ReminderProfile[] {
  const { day, minutes } = parisClock(now);
  return profiles.filter((p) => {
    if (!p.enabled || p.lastReminderOn === day) return false;
    const [h, m] = p.time.split(":").map(Number);
    const target = (h ?? 0) * 60 + (m ?? 0);
    return minutes >= target && minutes < target + windowMinutes;
  });
}

const MESSAGES = [
  "Une petite session de 10 minutes ? Ton fil t'attend.",
  "C'est l'heure que tu avais choisie. 10 minutes, une chose à la fois.",
  "Quelques cartes, tranquillement ? Tu peux t'arrêter quand tu veux.",
];

/** Message doux, sans reproche (jamais « tu as raté… »). */
export function reminderMessage(day: string): { title: string; body: string } {
  const i = Number(day.replace(/-/g, "")) % MESSAGES.length;
  return { title: "Fil", body: MESSAGES[i]! };
}
