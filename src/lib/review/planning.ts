/**
 * Planning d'examens à rebours (fonction pure, testable).
 * - Le travail restant de chaque matière est réparti jusqu'à la veille de son examen.
 * - La charge quotidienne totale est plafonnée (réglable).
 * - Un jour sauté n'est jamais « rattrapé » d'un coup : la charge du lendemain ne peut dépasser
 *   la charge prévue d'origine que de 25 %, le reste est étalé sur les jours suivants.
 */
export type PlanExam = { subjectId: string; date: string };
export type PlanDay = { day: string; total: number; bySubject: Record<string, number> };

const DAY = 86_400_000;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

export function planCountdown(input: {
  today: string;
  exams: PlanExam[];
  /** Minutes de travail restantes par matière. */
  remaining: Record<string, number>;
  capMinutes: number;
  /** Charge prévue hier (pour lisser le rattrapage après un jour sauté). */
  previousDaily?: number;
  horizonDays?: number;
}): PlanDay[] {
  const exams = input.exams
    .filter((e) => daysBetween(input.today, e.date) >= 1)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!exams.length) return [];
  const left: Record<string, number> = { ...input.remaining };
  const horizon = Math.min(input.horizonDays ?? 60, daysBetween(input.today, exams.at(-1)!.date));
  const days: PlanDay[] = [];
  let prev = input.previousDaily;
  for (let i = 0; i < horizon; i++) {
    const day = addDays(input.today, i);
    let budget = input.capMinutes;
    // Rattrapage progressif : au plus +25 % par rapport à la veille (sauf si la veille était vide).
    if (prev && prev > 0) budget = Math.min(budget, Math.ceil(prev * 1.25));
    const bySubject: Record<string, number> = {};
    for (const e of exams) {
      const daysLeft = daysBetween(day, e.date); // jours restants avant l'examen, aujourd'hui compris
      if (daysLeft < 1 || budget <= 0) continue;
      const need = Math.ceil((left[e.subjectId] ?? 0) / daysLeft);
      const give = Math.min(need, budget);
      if (give > 0) {
        bySubject[e.subjectId] = (bySubject[e.subjectId] ?? 0) + give;
        left[e.subjectId] = (left[e.subjectId] ?? 0) - give;
        budget -= give;
      }
    }
    const total = Object.values(bySubject).reduce((s, v) => s + v, 0);
    days.push({ day, total, bySubject });
    prev = total || prev;
  }
  return days;
}

/** Estimation du travail restant d'une matière, en minutes. */
export function remainingMinutes(input: { newNotions: number; unmasteredCards: number }): number {
  return Math.round(input.newNotions * 3 + input.unmasteredCards * 0.4);
}
