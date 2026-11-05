/** Correction des réponses de quiz (fonctions pures). Bienveillante : accents, casse et petites fautes tolérés. */
import { comparable } from "@/lib/text/normalize";

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

/** Réponse courte : égalité après normalisation, ou une faute de frappe tolérée sur les mots longs. */
export function shortAnswerCorrect(given: string, accepted: string[]): boolean {
  const g = comparable(given).replace(/^(le|la|les|l'|un|une|des) /, "");
  if (!g) return false;
  return accepted.some((a) => {
    const t = comparable(a).replace(/^(le|la|les|l'|un|une|des) /, "");
    if (!t) return false;
    if (g === t) return true;
    const tolerance = t.length >= 10 ? 2 : t.length >= 5 ? 1 : 0;
    return levenshtein(g, t) <= tolerance;
  });
}

export function blanksCorrect(given: string[], expected: string[]): boolean {
  return expected.length === given.length && expected.every((e, i) => shortAnswerCorrect(given[i] ?? "", [e]));
}

export function orderCorrect(given: string[], expected: string[]): boolean {
  return given.length === expected.length && given.every((g, i) => g === expected[i]);
}

export function associationCorrect(given: Record<string, string>, pairs: { left: string; right: string }[]): boolean {
  return pairs.every((p) => given[p.left] === p.right);
}

/** Mélange déterministe (même ordre à chaque réaffichage d'une carte, y compris après « J'ai décroché »). */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // Un ordre « mélangé » identique à la bonne réponse serait trop facile.
  if (out.length > 2 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}
