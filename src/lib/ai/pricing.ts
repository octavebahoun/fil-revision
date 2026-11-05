/**
 * Prix en USD par million de tokens (entrée, sortie). Les tokens de raisonnement sont facturés en sortie.
 * Valeurs prudentes (prix catalogue les plus hauts relevés en novembre 2026, non confirmés officiellement) :
 * mieux vaut surestimer que dépasser le budget. Surchargeable par AI_PRICING_JSON.
 */
type Price = { input: number; output: number };

const DEFAULT_PRICES: Record<string, Price> = {
  "deepseek-v4-pro": { input: 1.74, output: 3.48 },
  "deepseek-flash": { input: 0.14, output: 0.28 },
  "muse-spark-1.3-contributor": { input: 1.25, output: 4.25 },
  "muse-spark-1.3": { input: 1.25, output: 4.25 },
  "muse-wonder-1.0": { input: 1.25, output: 4.25 },
  mock: { input: 0, output: 0 },
};
const FALLBACK: Price = { input: 2, output: 6 };

function prices(): Record<string, Price> {
  const raw = process.env.AI_PRICING_JSON;
  if (!raw) return DEFAULT_PRICES;
  try {
    return { ...DEFAULT_PRICES, ...(JSON.parse(raw) as Record<string, Price>) };
  } catch {
    return DEFAULT_PRICES;
  }
}

export function priceFor(model: string): Price {
  return prices()[model] ?? (model.startsWith("mock") ? { input: 0, output: 0 } : FALLBACK);
}

export function costUsd(model: string, promptTokens: number, completionTokens: number): number {
  const p = priceFor(model);
  return (promptTokens * p.input + completionTokens * p.output) / 1_000_000;
}

/** Estimation d'une génération : ~4 caractères par token, sortie (raisonnement compris) bornée. */
export function estimateCostUsd(model: string, inputChars: number, expectedOutputTokens: number): number {
  return costUsd(model, Math.ceil(inputChars / 3.5), expectedOutputTokens);
}
