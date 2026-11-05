import { z } from "zod";
import { comparable, quoteSupported } from "@/lib/text/normalize";
import { UNTRUSTED_RULES, makeBoundary, wrapUntrusted } from "../untrusted";

// Tolérant sur la forme (id numérique, booléen en texte, raison longue), strict sur le fond.
export const VerifyOutput = z.object({
  verdicts: z.array(
    z.object({
      id: z.union([z.string(), z.number()]).transform(String),
      supported: z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]),
      reason: z
        .string()
        .optional()
        .default("")
        .transform((r) => r.slice(0, 300)),
    }),
  ),
});
export type VerifyOutput = z.infer<typeof VerifyOutput>;

export type VerifiableItem = {
  id: string;
  type: string;
  text: string;
  sourceQuote: string;
  sourcePages: number[];
  /** Texte affirmé comme vrai (sans les leurres de QCM ni les affirmations fausses) : ses faits doivent être dans la source. */
  facts?: string;
};

const NUMBER = /\d+(?:[.,]\d+)?/g;
// Mot à majuscule qui n'est pas en début de phrase (nom propre, produit), ou sigle.
const PROPER = /(?<![.!?:«"“]\s)(?<!^)\b\p{Lu}[\p{L}\d'-]{2,}/gu;
const ACRONYM = /\b\p{Lu}{2,}\d*\b/gu;

/**
 * Faits vérifiables d'un texte absents de la source : chiffres et noms propres.
 * Un exemple inventé (« John, 20 ans », « EcoCup ») est ainsi écarté même si la citation est juste.
 */
export function unsupportedFacts(text: string, source: string): string[] {
  const src = comparable(source);
  const srcDigits = source.replace(/\s+/g, "");
  const missing = new Set<string>();
  for (const n of text.match(NUMBER) ?? []) {
    // Les petits entiers (dénombrements : « 3 étapes ») sont tolérés.
    if (/^\d$|^10$/.test(n)) continue;
    if (!srcDigits.includes(n) && !srcDigits.includes(n.replace(".", ",")) && !srcDigits.includes(n.replace(",", ".")))
      missing.add(n);
  }
  for (const w of [...(text.match(PROPER) ?? []), ...(text.match(ACRONYM) ?? [])]) {
    const c = comparable(w);
    if (c.length >= 3 && !src.includes(c)) missing.add(w);
  }
  return [...missing];
}

/** 1re barrière, déterministe : la citation doit exister dans le texte source. */
export function deterministicCheck(
  items: VerifiableItem[],
  sourceText: string,
  /** Texte où chercher les noms propres et chiffres (tout le document) ; par défaut la source de la notion. */
  factsSource: string = sourceText,
): { kept: VerifiableItem[]; rejected: string[] } {
  const kept: VerifiableItem[] = [];
  const rejected: string[] = [];
  for (const it of items) {
    const factsOk = !it.facts || unsupportedFacts(it.facts, factsSource).length === 0;
    if (quoteSupported(it.sourceQuote, sourceText) && factsOk) kept.push(it);
    else rejected.push(it.id);
  }
  return { kept, rejected };
}

/** 2e barrière : un relecteur (modèle léger) confronte chaque élément au passage source. */
export function buildVerifyPrompt(items: VerifiableItem[], sourceText: string) {
  const boundary = makeBoundary();
  const system = `Tu es un relecteur exigeant. Pour chaque élément de révision, dis s'il est ENTIÈREMENT appuyé par le texte du cours.
${UNTRUSTED_RULES}
- "supported": true seulement si chaque affirmation de l'élément (question ET réponse) figure dans le texte ou s'en déduit directement.
- "supported": false si l'élément ajoute un fait, un chiffre, un nom, un exemple ou une règle absents du texte, ou s'il est faux.
- Une reformulation fidèle est acceptée. Mais un exemple, un nom, un chiffre, un produit ou un cas qui n'apparaît PAS dans le texte = "supported": false, même s'il est plausible ou « illustratif ».
Format JSON exact : {"verdicts": [{"id": "...", "supported": true, "reason": "..."}]} avec un verdict par élément.`;
  const list = items.map((i) => ({ id: i.id, type: i.type, contenu: i.text }));
  const user = `${wrapUntrusted("cours", sourceText, boundary)}\n\nÉléments à vérifier :\n${JSON.stringify(list)}`;
  return { system, user };
}

export function mockVerify(items: VerifiableItem[], sourceText: string): VerifyOutput {
  return {
    verdicts: items.map((i) => ({ id: i.id, supported: quoteSupported(i.sourceQuote, sourceText), reason: "" })),
  };
}
