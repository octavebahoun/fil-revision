import { comparable, normalizeSpaces } from "@/lib/text/normalize";

const PAGE_NUMBER = /^(page|p\.|diapo|slide)?\s*\d{1,4}\s*((\/|sur|of|-)\s*\d{1,4})?$/i;
// Lignes de sommaire : « 1.2 Titre . . . . . . 14 »
const TOC_LINE = /((\.\s?){4,}|…{2,}|_{4,})\s*[ivx\d]+$/i;
const URL_ONLY = /^(https?:\/\/|www\.)\S+$/i;
const PRINT_ARTIFACT = /(google slides|\.pptx\s*-|about:blank|^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2})/i;

/** Clé de comparaison : les chiffres ne sont ignorés que sur les lignes courtes, ≤ 30 caractères (« Page 3 », « BDD – 2026 – 4 »). */
function lineKey(line: string) {
  const c = comparable(line);
  return line.length <= 30 ? c.replace(/\d+/g, "#") : c;
}

/**
 * Nettoyage : en-têtes / pieds de page répétés, numéros de page, artefacts d'impression,
 * coupures de mots en fin de ligne. Le contenu pédagogique n'est jamais réécrit.
 */
export function cleanPages(rawPages: string[]): string[] {
  const pages = rawPages.map((p) =>
    normalizeSpaces(p)
      .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );

  // Lignes répétées en haut ou en bas de page sur une bonne partie du document
  // (en-têtes, pieds, bandeaux de navigation de diaporama sur plusieurs lignes).
  const HEAD = 10;
  const TAIL = 5;
  const counts = new Map<string, number>();
  for (const lines of pages) {
    const edges = new Set([...lines.slice(0, HEAD), ...lines.slice(-TAIL)].map(lineKey));
    for (const k of edges) if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.4));
  const repeated = new Set([...counts].filter(([, n]) => pages.length >= 4 && n >= threshold).map(([k]) => k));

  return pages.map((lines) => {
    const kept = lines.filter((line, i) => {
      const atEdge = i < HEAD || i >= lines.length - TAIL;
      if (PAGE_NUMBER.test(line)) return false;
      if (TOC_LINE.test(line)) return false;
      const nearEdge = i < 2 || i >= lines.length - 2;
      if (URL_ONLY.test(line) && nearEdge) return false;
      if (PRINT_ARTIFACT.test(line) && nearEdge) return false;
      if (atEdge && line.length <= 140 && repeated.has(lineKey(line))) return false;
      return true;
    });
    return kept.join("\n").trim();
  });
}

export function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length;
}
