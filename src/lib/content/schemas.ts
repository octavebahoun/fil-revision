import { z } from "zod";

/**
 * Formats des contenus générés (stockés dans cards.content).
 * Limites de longueur = règle « 5 lignes max sur mobile » (≈ 40 caractères par ligne).
 */
export const LIMITS = {
  // Fiche = 5 lignes de 100 caractères : 2 (explication) + 2 (exemple) + 1 (question).
  // Sur mobile (~40 caractères par ligne), chaque bloc reste sous 5 lignes.
  explanation: 200,
  example: 200,
  question: 100,
  answer: 300,
  more: 700,
  front: 160,
  back: 280,
  quizQuestion: 220,
  choice: 140,
  explain: 220,
  quote: 400,
} as const;

const short = (max: number) => z.string().trim().min(1).max(max);

export const FicheContent = z.object({
  title: short(90),
  explanation: short(LIMITS.explanation),
  example: short(LIMITS.example),
  // UNE seule question : si le modèle en enchaîne plusieurs, on garde la première.
  question: z.preprocess(
    (v) => (typeof v === "string" && v.includes("?") ? v.slice(0, v.indexOf("?") + 1).trim() : v),
    short(LIMITS.question).refine((q) => q.endsWith("?"), { message: "Une seule question, terminée par « ? »" }),
  ),
  answer: short(LIMITS.answer),
  more: z.string().trim().max(LIMITS.more).optional().default(""),
});

export const FlashcardContent = z.object({ front: short(LIMITS.front), back: short(LIMITS.back) });

export const QcmContent = z
  .object({
    question: short(LIMITS.quizQuestion),
    choices: z.array(short(LIMITS.choice)).min(2).max(5),
    answerIndex: z.number().int().min(0),
    explanation: short(LIMITS.explain),
  })
  .refine((q) => q.answerIndex < q.choices.length, { message: "answerIndex hors limites" })
  .refine((q) => new Set(q.choices.map((c) => c.toLowerCase())).size === q.choices.length, {
    message: "Choix en double",
  });

export const VraiFauxContent = z.object({
  statement: short(LIMITS.quizQuestion),
  answer: z.boolean(),
  explanation: short(LIMITS.explain),
});

export const ReponseCourteContent = z.object({
  question: short(LIMITS.quizQuestion),
  answers: z.array(short(80)).min(1).max(6),
  explanation: short(LIMITS.explain),
});

export const CodeTrouContent = z
  .object({
    language: z.string().trim().min(1).max(20),
    question: short(LIMITS.quizQuestion),
    code: z.string().min(3).max(900),
    blanks: z.array(short(80)).min(1).max(4),
    explanation: short(LIMITS.explain),
  })
  .refine((c) => (c.code.match(/____/g)?.length ?? 0) === c.blanks.length, {
    message: "Chaque trou ____ doit avoir sa réponse",
  });

export const OrdreContent = z.object({
  question: short(LIMITS.quizQuestion),
  items: z.array(short(120)).min(3).max(7),
  explanation: short(LIMITS.explain),
});

export const AssociationContent = z.object({
  question: short(LIMITS.quizQuestion),
  pairs: z
    .array(z.object({ left: short(80), right: short(120) }))
    .min(2)
    .max(6),
  explanation: short(LIMITS.explain),
});

export const VocabContent = z.object({
  en: short(80),
  fr: short(80),
  example: z.string().trim().max(160).optional().default(""),
});

export const PhraseContent = z.object({
  en: short(160),
  fr: short(160),
  context: z.string().trim().max(120).optional().default(""),
});

export const CodeExerciseContent = z.object({
  language: z.enum(["sql", "php", "js", "ts", "tsx"]),
  title: short(90),
  prompt: short(400),
  starter: z.string().max(2000).default(""),
  setup: z.string().max(4000).optional().default(""),
  solution: z.string().min(1).max(3000),
  expectedOutput: z.string().max(2000).optional().default(""),
  hints: z.array(short(200)).max(3).default([]),
});

export const CARD_CONTENT = {
  fiche: FicheContent,
  flashcard: FlashcardContent,
  qcm: QcmContent,
  vrai_faux: VraiFauxContent,
  reponse_courte: ReponseCourteContent,
  code_trou: CodeTrouContent,
  ordre: OrdreContent,
  association: AssociationContent,
  vocab: VocabContent,
  phrase: PhraseContent,
  code_exercise: CodeExerciseContent,
} as const;

export type CardType = keyof typeof CARD_CONTENT;
export const QUIZ_TYPES = ["qcm", "vrai_faux", "reponse_courte", "code_trou", "ordre", "association"] as const;
export type QuizType = (typeof QUIZ_TYPES)[number];
export const REVIEWABLE_TYPES: CardType[] = ["flashcard", ...QUIZ_TYPES, "vocab", "phrase"];

export type FicheContent = z.infer<typeof FicheContent>;
export type FlashcardContent = z.infer<typeof FlashcardContent>;
export type QcmContent = z.infer<typeof QcmContent>;
export type VraiFauxContent = z.infer<typeof VraiFauxContent>;
export type ReponseCourteContent = z.infer<typeof ReponseCourteContent>;
export type CodeTrouContent = z.infer<typeof CodeTrouContent>;
export type OrdreContent = z.infer<typeof OrdreContent>;
export type AssociationContent = z.infer<typeof AssociationContent>;
export type VocabContent = z.infer<typeof VocabContent>;
export type PhraseContent = z.infer<typeof PhraseContent>;
export type CodeExerciseContent = z.infer<typeof CodeExerciseContent>;

export function parseCardContent(type: CardType, content: unknown) {
  return CARD_CONTENT[type].safeParse(content);
}

/** Contrôle automatique de longueur d'une fiche (en plus du schéma) : 5 lignes au plus. */
export function ficheLineCount(
  f: Pick<FicheContent, "explanation" | "example" | "question">,
  charsPerLine = 100,
): number {
  return [f.explanation, f.example, f.question].reduce(
    (n, s) => n + Math.max(1, Math.ceil(s.length / charsPerLine)),
    0,
  );
}

export function ficheTooLong(f: Pick<FicheContent, "explanation" | "example" | "question">): boolean {
  return ficheLineCount(f) > 5;
}
