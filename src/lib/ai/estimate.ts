import { costUsd } from "./pricing";

/**
 * Estimation (prudente) du coût de préparation d'une notion :
 * fiche + flashcards, quiz (modèle principal), relecture (modèle léger, avec raisonnement).
 * `reasoningFactor` : multiplicateur de sortie pour les modèles qui raisonnent toujours (Meta).
 */
const SYSTEM_TOKENS = 900;

type Models = { main: string; light: string; reasoningFactor?: number };

export function estimateNotionCostUsd(sourceChars: number, models: Models): number {
  const src = Math.ceil(sourceChars / 3.2);
  const k = models.reasoningFactor ?? 1;
  const fiche = costUsd(models.main, SYSTEM_TOKENS + src, 750 * k);
  const quiz = costUsd(models.main, SYSTEM_TOKENS + src, 950 * k);
  const verify = costUsd(models.light, 600 + src + 700, 2600);
  // +25 % de marge pour les nouvelles tentatives (format, vérification).
  return (fiche + quiz + verify) * 1.25;
}

export function estimateDocumentCostUsd(notionSourceChars: number[], models: Models): number {
  return notionSourceChars.reduce((sum, chars) => sum + estimateNotionCostUsd(chars, models), 0);
}

export function formatUsd(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: v < 0.1 ? 3 : 2,
  }).format(v);
}
