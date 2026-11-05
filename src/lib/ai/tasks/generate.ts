import { z } from "zod";
import {
  AssociationContent,
  CodeTrouContent,
  FicheContent,
  FlashcardContent,
  LIMITS,
  OrdreContent,
  PhraseContent,
  QcmContent,
  ReponseCourteContent,
  VocabContent,
  VraiFauxContent,
  ficheTooLong,
} from "@/lib/content/schemas";
import { sentences, truncateWords } from "@/lib/text/normalize";
import { UNTRUSTED_RULES, makeBoundary, wrapUntrusted } from "../untrusted";
import { STYLE_RULES } from "./style";

// Une citation trop longue est tronquée (le début reste une citation exacte) plutôt que refusée.
const Source = z.object({
  sourceQuote: z
    .string()
    .trim()
    .min(8)
    .transform((q) => q.slice(0, LIMITS.quote)),
  sourcePages: z
    .array(z.number().int().positive())
    .min(1)
    .transform((p) => p.slice(0, 6)),
});

/**
 * Liste tolérante : un élément mal formé est écarté (il ne sera simplement pas enregistré)
 * au lieu de faire rejeter toute la réponse. La liste doit garder au moins `min` éléments valides.
 */
export function lenientArray<T extends z.ZodType>(schema: T, min: number, max: number) {
  return z
    .array(z.unknown())
    .max(30)
    .transform((arr) =>
      arr
        .flatMap((x) => {
          const r = schema.safeParse(x);
          return r.success ? [r.data as z.output<T>] : [];
        })
        .slice(0, max),
    )
    .refine((arr) => arr.length >= min, { message: `Au moins ${min} élément(s) valide(s)` });
}

export const GenFicheOutput = z.object({
  fiche: FicheContent.and(Source),
  flashcards: lenientArray(FlashcardContent.and(Source), 1, 5),
  vocab: lenientArray(VocabContent.and(Source), 0, 8).optional().default([]),
  phrases: lenientArray(PhraseContent.and(Source), 0, 5).optional().default([]),
});
export type GenFicheOutput = z.infer<typeof GenFicheOutput>;

const withType = <T extends z.ZodType, K extends string>(type: K, schema: T) =>
  z
    .object({ type: z.literal(type) })
    .and(schema)
    .and(Source);

export const QuizItem = z.union([
  withType("qcm", QcmContent),
  withType("vrai_faux", VraiFauxContent),
  withType("reponse_courte", ReponseCourteContent),
  withType("code_trou", CodeTrouContent),
  withType("ordre", OrdreContent),
  withType("association", AssociationContent),
]);
export type QuizItem = z.infer<typeof QuizItem>;
export const GenQuizOutput = z.object({ quiz: lenientArray(QuizItem, 2, 6) });
export type GenQuizOutput = z.infer<typeof GenQuizOutput>;

export type NotionInput = {
  title: string;
  subject: string;
  pages: number[];
  sourceText: string;
  language: "fr" | "en";
  /** Consigne de régénération (ex. carte signalée fausse). */
  feedback?: string;
};

const SOURCE_RULES = `CITATIONS (obligatoire pour chaque élément) :
- "sourceQuote" : un extrait COPIÉ MOT POUR MOT du texte du cours (15 à 300 caractères) qui prouve l'élément.
- "sourcePages" : le ou les numéros de page [p. N] où se trouve cet extrait.
- Si une information n'est pas dans le texte, tu ne l'écris pas. Zéro invention, même plausible.`;

export function buildFichePrompt(n: NotionInput) {
  const boundary = makeBoundary();
  const english = n.language === "en";
  const system = `Tu es un tuteur bienveillant. Tu crées le matériel de révision d'UNE notion, à partir du seul texte de cours fourni.
${UNTRUSTED_RULES}
${STYLE_RULES}

FICHE (5 lignes au total, lisible sur téléphone) :
- "title" : le nom de la notion.
- "explanation" : 1 à 2 phrases courtes, ${LIMITS.explanation} caractères MAX (2 lignes). L'idée essentielle.
- "example" : 1 à 2 phrases courtes, ${LIMITS.example} caractères MAX (2 lignes). Un exemple TIRÉ DU COURS (un cas, un chiffre, une phrase ou un exercice du texte). N'invente jamais de nom, de chiffre, d'entreprise ou de produit : si le cours n'a pas d'exemple, reprends une application directe de ce qu'il dit.
- "question" : UNE seule question de vérification, ${LIMITS.question} caractères MAX (1 ligne), terminée par « ? ».
- "answer" : la réponse attendue, ${LIMITS.answer} caractères max.
- "more" : facultatif, détails utiles pour « En savoir plus », ${LIMITS.more} caractères max.

FLASHCARDS : 2 à 4 cartes. "front" = une question courte (${LIMITS.front} car. max), "back" = la réponse (${LIMITS.back} car. max). Une seule idée par carte.
${
  english
    ? `COURS D'ANGLAIS : ajoute "vocab" (3 à 8 mots ou expressions : "en", "fr", "example" en anglais) et "phrases" (1 à 5 phrases utiles : "en", "fr", "context").`
    : `"vocab" et "phrases" : listes vides.`
}
${SOURCE_RULES}

Format JSON exact :
{"fiche": {"title": "", "explanation": "", "example": "", "question": "", "answer": "", "more": "", "sourceQuote": "", "sourcePages": [1]},
 "flashcards": [{"front": "", "back": "", "sourceQuote": "", "sourcePages": [1]}],
 "vocab": [], "phrases": []}`;
  const user = `Matière : ${n.subject}\nNotion : « ${n.title} » (pages ${n.pages.join(", ")})${
    n.feedback ? `\nATTENTION, correction demandée : ${n.feedback}` : ""
  }\n${wrapUntrusted("cours", n.sourceText, boundary)}`;
  return { system, user };
}

export function buildQuizPrompt(n: NotionInput, hasCode: boolean) {
  const boundary = makeBoundary();
  const system = `Tu es un tuteur bienveillant. Tu crées 3 à 5 questions de quiz sur UNE notion, à partir du seul texte de cours fourni.
${UNTRUSTED_RULES}
${STYLE_RULES}

TYPES (varie-les, chaque objet a un champ "type") :
- "qcm" : {"question", "choices": 3 ou 4 choix courts et plausibles, "answerIndex": index de la bonne réponse (0 = premier), "explanation"}
- "vrai_faux" : {"statement", "answer": true|false, "explanation"}
- "reponse_courte" : {"question", "answers": réponses acceptées (1 à 4 mots chacune, variantes incluses), "explanation"}
- "ordre" : {"question", "items": 3 à 6 éléments DANS LE BON ORDRE, "explanation"} — seulement si le cours décrit une séquence.
- "association" : {"question", "pairs": 2 à 5 paires {"left", "right"}, "explanation"}
${hasCode ? `- "code_trou" : {"language", "question", "code" avec ____ pour chaque trou, "blanks": les réponses dans l'ordre, "explanation"} — le code doit venir du cours.` : `- Pas de "code_trou" (pas de code dans ce passage).`}
"explanation" : une correction bienveillante de ${LIMITS.explain} caractères max, qui explique pourquoi.
Questions de ${LIMITS.quizQuestion} caractères max. Pas de piège, pas de double négation. Pas de question sur le temps ou la vitesse.
Les leurres de QCM peuvent être faux, mais la bonne réponse, l'explication et les affirmations vraies doivent venir du texte.
${SOURCE_RULES}

Format JSON exact : {"quiz": [{"type": "qcm", "question": "", "choices": ["", "", ""], "answerIndex": 0, "explanation": "", "sourceQuote": "", "sourcePages": [1]}]}`;
  const user = `Matière : ${n.subject}\nNotion : « ${n.title} »${
    n.feedback ? `\nATTENTION, correction demandée : ${n.feedback}` : ""
  }\n${wrapUntrusted("cours", n.sourceText, boundary)}`;
  return { system, user };
}

export function ficheCheck(out: GenFicheOutput): string | null {
  if (!ficheTooLong(out.fiche)) return null;
  const f = out.fiche;
  return `La fiche dépasse 5 lignes. Longueurs actuelles : explanation ${f.explanation.length} (max ${LIMITS.explanation}), example ${f.example.length} (max ${LIMITS.example}), question ${f.question.length} (max ${LIMITS.question}) caractères. Raccourcis.`;
}

/** Phrases du texte source (sans les repères [p. N]) avec leur page. */
export function sourceSentences(sourceText: string): { text: string; page: number }[] {
  const out: { text: string; page: number }[] = [];
  let page = 1;
  for (const block of sourceText.split(/(\[p\. \d+\])/)) {
    const m = /^\[p\. (\d+)\]$/.exec(block);
    if (m) {
      page = Number(m[1]);
      continue;
    }
    for (const s of sentences(block)) if (s.length >= 25 && /\p{L}{3,}/u.test(s)) out.push({ text: s, page });
  }
  return out;
}

/** Sortie déterministe du fournisseur simulé : uniquement des extraits du cours. */
export function mockFiche(n: NotionInput): GenFicheOutput {
  const ss = sourceSentences(n.sourceText);
  const pick = (i: number) =>
    ss[i % Math.max(ss.length, 1)] ?? { text: `${n.title} est présenté dans le cours.`, page: n.pages[0] ?? 1 };
  const s0 = pick(0);
  const s1 = pick(1);
  const quote = (s: { text: string }) => truncateWords(s.text, 200).replace(/…$/, "");
  return {
    fiche: {
      title: truncateWords(n.title, 90),
      explanation: truncateWords(s0.text, 190),
      example: truncateWords(s1.text, 190),
      question: truncateWords(`Comment expliquerais-tu « ${truncateWords(n.title, 50)} »`, 95) + " ?",
      answer: truncateWords(s0.text, 280),
      more:
        ss.length > 2
          ? truncateWords(
              ss
                .slice(2, 5)
                .map((s) => s.text)
                .join(" "),
              600,
            )
          : "",
      sourceQuote: quote(s0),
      sourcePages: [s0.page],
    },
    flashcards: [1, 2, 3].map((i) => {
      const s = pick(i);
      return {
        front: truncateWords(`Que dit le cours sur « ${truncateWords(n.title, 50)} » (point ${i}) ?`, 150),
        back: truncateWords(s.text, 270),
        sourceQuote: quote(s),
        sourcePages: [s.page],
      };
    }),
    vocab:
      n.language === "en"
        ? [
            {
              en: "to finish",
              fr: "terminer",
              example: truncateWords(s0.text, 150),
              sourceQuote: quote(s0),
              sourcePages: [s0.page],
            },
          ]
        : [],
    phrases:
      n.language === "en"
        ? [
            {
              en: truncateWords(s0.text, 150),
              fr: "(traduction)",
              context: "présentation",
              sourceQuote: quote(s0),
              sourcePages: [s0.page],
            },
          ]
        : [],
  };
}

export function mockQuiz(n: NotionInput): GenQuizOutput {
  const ss = sourceSentences(n.sourceText);
  const s = (i: number) =>
    ss[i % Math.max(ss.length, 1)] ?? { text: `${n.title} est une notion du cours.`, page: n.pages[0] ?? 1 };
  const quote = (x: { text: string }) => truncateWords(x.text, 200).replace(/…$/, "");
  const a = s(0);
  const b = s(1);
  const words = a.text
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4);
  return {
    quiz: [
      {
        type: "vrai_faux",
        statement: truncateWords(a.text, 200),
        answer: true,
        explanation: "C'est écrit tel quel dans le cours.",
        sourceQuote: quote(a),
        sourcePages: [a.page],
      },
      {
        type: "qcm",
        question: truncateWords(`Quelle phrase vient du cours sur « ${truncateWords(n.title, 60)} » ?`, 200),
        choices: [truncateWords(b.text, 130), "Aucune des propositions", "Ce point n'est pas abordé"],
        answerIndex: 0,
        explanation: "La première proposition reprend le cours.",
        sourceQuote: quote(b),
        sourcePages: [b.page],
      },
      {
        type: "ordre",
        question: "Remets ces mots dans l'ordre du cours.",
        items: words.length >= 3 ? words.map((w) => truncateWords(w, 100)) : ["Lire", "Comprendre", "Retenir"],
        explanation: "C'est l'ordre de la phrase du cours.",
        sourceQuote: quote(a),
        sourcePages: [a.page],
      },
    ],
  };
}
