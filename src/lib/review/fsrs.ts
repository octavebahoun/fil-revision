import { createEmptyCard, fsrs, generatorParameters, type Card, type Grade } from "ts-fsrs";

/** Planificateur FSRS : rétention visée 90 %, pas d'aléa (résultats reproductibles), intervalle max 1 an. */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false, request_retention: 0.9, maximum_interval: 365 }));

export type StateRow = {
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

export function toCard(row: StateRow | null, now: Date): Card {
  if (!row) return createEmptyCard(now);
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as Card["state"],
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

export function fromCard(card: Card): StateRow {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

/** Applique une note 1–4 (À revoir, Difficile, Bien, Facile). */
export function applyRating(row: StateRow | null, rating: 1 | 2 | 3 | 4, at: Date): StateRow {
  const next = scheduler.next(toCard(row, at), at, rating as Grade);
  return fromCard(next.card);
}

/** Note dérivée d'une réponse de quiz : juste = Bien, faux = À revoir. */
export function ratingFromCorrect(correct: boolean): 1 | 3 {
  return correct ? 3 : 1;
}
