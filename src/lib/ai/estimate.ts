import { costUsd } from "./pricing";

/**
 * Estimation (prudente) du coût de préparation d'une notion :
 * fiche + flashcards, quiz (modèle principal, sans raisonnement), relecture (modèle léger, avec raisonnement).
 */
const SYSTEM_TOKENS = 900;

export function estimateNotionCostUsd(sourceChars: number, models: { main: string; light: string }): number {
  const src = Math.ceil(sourceChars / 3.2);
  const fiche = costUsd(models.main, SYSTEM_TOKENS + src, 750);
  const quiz = costUsd(models.main, SYSTEM_TOKENS + src, 950);
  const verify = costUsd(models.light, 600 + src + 700, 2600);
  // +25 % de marge pour les nouvelles tentatives (format, vérification).
  return (fiche + quiz + verify) * 1.25;
}

export function estimateDocumentCostUsd(notionSourceChars: number[], models: { main: string; light: string }): number {
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
