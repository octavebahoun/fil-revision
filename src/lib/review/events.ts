import { z } from "zod";

/**
 * Événements d'apprentissage envoyés par le navigateur (sauvegarde continue, hors ligne compris).
 * Chacun a un identifiant unique : renvoyer deux fois le même événement n'a aucun effet (pas de doublon).
 */
const Iso = z.iso.datetime({ offset: true });

export const ReviewEvent = z.object({
  kind: z.literal("review"),
  id: z.uuid(),
  cardId: z.uuid(),
  sessionId: z.uuid().nullable(),
  outcome: z.enum(["rated", "absent"]),
  rating: z.number().int().min(1).max(4).nullable(),
  correct: z.boolean().nullable(),
  answer: z.unknown().optional(),
  at: Iso,
});

export const UndoEvent = z.object({ kind: z.literal("undo"), id: z.uuid(), reviewId: z.uuid(), at: Iso });

export const PositionEvent = z.object({
  kind: z.literal("position"),
  id: z.uuid(),
  sessionId: z.uuid(),
  position: z.number().int().min(0).max(1000),
  at: Iso,
});

export const SessionEvent = z.object({
  kind: z.literal("session_event"),
  id: z.uuid(),
  sessionId: z.uuid(),
  type: z.enum(["decroche", "reprise", "pause"]),
  cardId: z.uuid().nullable(),
  at: Iso,
});

export const SessionEndEvent = z.object({
  kind: z.literal("session_end"),
  id: z.uuid(),
  sessionId: z.uuid(),
  stats: z.object({
    answered: z.number().int().min(0),
    correct: z.number().int().min(0),
    decroches: z.number().int().min(0),
  }),
  at: Iso,
});

export const ParkingEvent = z.object({
  kind: z.literal("parking"),
  id: z.uuid(),
  sessionId: z.uuid().nullable(),
  text: z.string().trim().min(1).max(1000),
  at: Iso,
});

export const SyncEvent = z.discriminatedUnion("kind", [
  ReviewEvent,
  UndoEvent,
  PositionEvent,
  SessionEvent,
  SessionEndEvent,
  ParkingEvent,
]);
export type SyncEvent = z.infer<typeof SyncEvent>;
export const SyncBody = z.object({ events: z.array(SyncEvent).min(1).max(200) });
