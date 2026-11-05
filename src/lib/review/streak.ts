/**
 * Série de jours avec jokers automatiques. Jamais de reproche : si la série s'arrête,
 * elle repart simplement de 1, sans message négatif.
 */
export type Streak = { current: number; best: number; jokers: number; lastDay: string | null };

export const MAX_JOKERS = 3;
const DAY = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

export function parisDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Met à jour la série quand l'utilisateur a révisé le jour `today` (AAAA-MM-JJ). */
export function updateStreak(s: Streak, today: string): Streak & { usedJokers: number; earnedJoker: boolean } {
  if (s.lastDay === today) return { ...s, usedJokers: 0, earnedJoker: false };
  let current = 1;
  let jokers = s.jokers;
  let usedJokers = 0;
  if (s.lastDay) {
    const gap = daysBetween(s.lastDay, today) - 1; // jours manqués
    if (gap <= 0) current = s.current + 1;
    else if (gap <= jokers) {
      jokers -= gap;
      usedJokers = gap;
      current = s.current + 1;
    }
  }
  // Un joker gagné tous les 7 jours de série (3 au maximum).
  const earnedJoker = current > 0 && current % 7 === 0 && jokers < MAX_JOKERS;
  if (earnedJoker) jokers += 1;
  return { current, best: Math.max(s.best, current), jokers, lastDay: today, usedJokers, earnedJoker };
}

/** Série « vivante » à afficher aujourd'hui (sans la modifier). */
export function displayStreak(s: Streak, today: string): number {
  if (!s.lastDay) return 0;
  const gap = daysBetween(s.lastDay, today) - 1;
  if (gap <= 0) return s.current;
  return gap <= s.jokers ? s.current : 0;
}
