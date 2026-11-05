/**
 * Construction d'une session (fonction pure, testable).
 * Mélange de cartes dues (FSRS) et de nouvelles notions (fiche puis cartes), dans un budget de temps.
 */
export type CardLite = { cardId: string; type: string; notionId: string; subjectId: string };
export type NewNotion = { notionId: string; subjectId: string; ficheId: string | null; cards: CardLite[] };
export type SessionItem = { cardId: string; type: string; notionId: string; fresh: boolean };
export type Mode = "mix" | "fiches" | "flashcards" | "quiz" | "fatigue" | "notion" | "exam";

const SECONDS: Record<string, number> = {
  fiche: 45,
  flashcard: 15,
  vocab: 12,
  phrase: 15,
  vrai_faux: 20,
  qcm: 25,
  reponse_courte: 30,
  ordre: 40,
  association: 40,
  code_trou: 40,
};

export const QUIZ = new Set(["qcm", "vrai_faux", "reponse_courte", "code_trou", "ordre", "association"]);
export const FLASH = new Set(["flashcard", "vocab", "phrase"]);

export function itemSeconds(type: string): number {
  return SECONDS[type] ?? 25;
}

function fits(mode: Mode, type: string) {
  if (mode === "flashcards") return FLASH.has(type);
  if (mode === "quiz") return QUIZ.has(type);
  if (mode === "fiches") return type === "fiche";
  return true;
}

/** Cartes d'une nouvelle notion : la fiche d'abord, puis une flashcard et un ou deux quiz variés. */
function newNotionBlock(n: NewNotion, mode: Mode): SessionItem[] {
  const items: SessionItem[] = [];
  if (n.ficheId && (mode === "mix" || mode === "fiches" || mode === "notion"))
    items.push({ cardId: n.ficheId, type: "fiche", notionId: n.notionId, fresh: true });
  if (mode === "fiches") return items;
  const flash = n.cards.filter((c) => FLASH.has(c.type));
  const quiz = n.cards.filter((c) => QUIZ.has(c.type));
  const picked =
    mode === "flashcards"
      ? flash.slice(0, 3)
      : mode === "quiz"
        ? quiz.slice(0, 3)
        : mode === "notion"
          ? n.cards
          : [...flash.slice(0, 1), ...quiz.slice(0, 2)];
  for (const c of picked) items.push({ cardId: c.cardId, type: c.type, notionId: c.notionId, fresh: true });
  return items;
}

export function buildSession(input: {
  mode: Mode;
  minutes: number;
  due: CardLite[];
  fresh: NewNotion[];
  easy?: CardLite[];
}): SessionItem[] {
  const budget = input.minutes * 60;
  let used = 0;
  const take = (type: string) => {
    const s = itemSeconds(type);
    if (used + s > budget && used > 0) return false;
    used += s;
    return true;
  };

  if (input.mode === "fatigue") {
    const out: SessionItem[] = [];
    for (const c of input.easy ?? []) {
      if (!take(c.type)) break;
      out.push({ cardId: c.cardId, type: c.type, notionId: c.notionId, fresh: false });
    }
    return out;
  }

  const due = input.due.filter((c) => fits(input.mode, c.type));
  const blocks = input.fresh.map((n) => newNotionBlock(n, input.mode)).filter((b) => b.length);
  // Les cartes dues passent d'abord, mais on garde ~40 % du temps pour avancer (s'il y a du nouveau).
  const dueBudget = blocks.length ? budget * 0.6 : budget;

  const dueItems: SessionItem[] = [];
  for (const c of due) {
    if (used + itemSeconds(c.type) > dueBudget && dueItems.length > 0) break;
    used += itemSeconds(c.type);
    dueItems.push({ cardId: c.cardId, type: c.type, notionId: c.notionId, fresh: false });
  }
  const newBlocks: SessionItem[][] = [];
  for (const b of blocks) {
    const cost = b.reduce((s, i) => s + itemSeconds(i.type), 0);
    if (used + cost > budget && (newBlocks.length > 0 || dueItems.length > 0)) break;
    used += cost;
    newBlocks.push(b);
  }
  // Entrelace : un bloc nouveau toutes les 3 cartes dues (varie les efforts, évite la monotonie).
  const out: SessionItem[] = [];
  let d = 0;
  for (const b of newBlocks) {
    out.push(...dueItems.slice(d, d + 3));
    d += 3;
    out.push(...b);
  }
  out.push(...dueItems.slice(d));
  return out;
}
