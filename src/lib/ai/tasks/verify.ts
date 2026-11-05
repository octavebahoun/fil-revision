import { z } from "zod";
import { quoteSupported } from "@/lib/text/normalize";
import { UNTRUSTED_RULES, makeBoundary, wrapUntrusted } from "../untrusted";

export const VerifyOutput = z.object({
  verdicts: z.array(
    z.object({ id: z.string(), supported: z.boolean(), reason: z.string().max(300).optional().default("") }),
  ),
});
export type VerifyOutput = z.infer<typeof VerifyOutput>;

export type VerifiableItem = { id: string; type: string; text: string; sourceQuote: string; sourcePages: number[] };

/** 1re barrière, déterministe : la citation doit exister dans le texte source. */
export function deterministicCheck(
  items: VerifiableItem[],
  sourceText: string,
): { kept: VerifiableItem[]; rejected: string[] } {
  const kept: VerifiableItem[] = [];
  const rejected: string[] = [];
  for (const it of items) {
    if (quoteSupported(it.sourceQuote, sourceText)) kept.push(it);
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
- Une reformulation fidèle est acceptée. Un exemple purement illustratif est accepté s'il ne contredit rien et n'ajoute aucun fait.
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
