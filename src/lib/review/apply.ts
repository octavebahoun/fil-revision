import type { Json } from "@/lib/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";
import { applyRating, type StateRow } from "./fsrs";
import { parisDay, updateStreak, type Streak } from "./streak";
import type { SyncEvent } from "./events";

const STATE_COLS = "due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, state, last_review";

async function currentState(db: ServerSupabase, cardId: string): Promise<StateRow | null> {
  const { data } = await db.from("card_states").select(STATE_COLS).eq("card_id", cardId).maybeSingle();
  return (data as StateRow | null) ?? null;
}

/**
 * Applique les événements d'apprentissage, dans l'ordre, de façon idempotente.
 * - Une révision « absent » ou non notée ne touche jamais FSRS.
 * - « undo » (J'ai décroché) restaure l'état d'avant la réponse, qui ne compte plus comme une erreur.
 */
export async function applyEvents(
  db: ServerSupabase,
  userId: string,
  events: SyncEvent[],
): Promise<{ applied: string[]; skipped: string[] }> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  for (const ev of sorted) {
    switch (ev.kind) {
      case "review": {
        const { data: exists } = await db.from("reviews").select("id").eq("id", ev.id).maybeSingle();
        if (exists) {
          skipped.push(ev.id);
          break;
        }
        const before = await currentState(db, ev.cardId);
        const at = new Date(ev.at);
        const after = ev.outcome === "rated" && ev.rating ? applyRating(before, ev.rating as 1 | 2 | 3 | 4, at) : null;
        const { error } = await db.from("reviews").insert({
          id: ev.id,
          user_id: userId,
          card_id: ev.cardId,
          session_id: ev.sessionId,
          outcome: ev.outcome,
          rating: ev.outcome === "rated" ? ev.rating : null,
          correct: ev.correct,
          answer: (ev.answer ?? null) as Json,
          state_before: before as unknown as Json,
          state_after: after as unknown as Json,
          reviewed_at: ev.at,
        });
        if (error) {
          // Doublon concurrent (deux onglets) : déjà enregistré, rien à faire.
          if (error.code === "23505") skipped.push(ev.id);
          else throw error;
          break;
        }
        if (after)
          await db
            .from("card_states")
            .upsert({ card_id: ev.cardId, user_id: userId, ...after, updated_at: new Date().toISOString() });
        applied.push(ev.id);
        break;
      }
      case "undo": {
        const { data: rev } = await db
          .from("reviews")
          .select("id, card_id, state_before, undone, reviewed_at")
          .eq("id", ev.reviewId)
          .maybeSingle();
        if (!rev || rev.undone) {
          skipped.push(ev.id);
          break;
        }
        // On ne restaure que si c'est la dernière réponse sur cette carte (sinon l'état a déjà évolué).
        const { data: later } = await db
          .from("reviews")
          .select("id")
          .eq("card_id", rev.card_id)
          .eq("undone", false)
          .gt("reviewed_at", rev.reviewed_at)
          .limit(1);
        if (!later?.length) {
          if (rev.state_before) {
            await db
              .from("card_states")
              .upsert({ card_id: rev.card_id, user_id: userId, ...(rev.state_before as unknown as StateRow) });
          } else {
            await db.from("card_states").delete().eq("card_id", rev.card_id);
          }
        }
        await db.from("reviews").update({ undone: true, outcome: "absent", rating: null }).eq("id", rev.id);
        applied.push(ev.id);
        break;
      }
      case "position": {
        // Les événements arrivent dans l'ordre (file d'envoi séquentielle) : la dernière position gagne.
        await db
          .from("study_sessions")
          .update({ position: ev.position, updated_at: new Date().toISOString() })
          .eq("id", ev.sessionId)
          .eq("status", "active");
        applied.push(ev.id);
        break;
      }
      case "session_event": {
        const { error } = await db
          .from("session_events")
          .upsert(
            { id: ev.id, user_id: userId, session_id: ev.sessionId, type: ev.type, card_id: ev.cardId, at: ev.at },
            { onConflict: "id", ignoreDuplicates: true },
          );
        if (error) throw error;
        applied.push(ev.id);
        break;
      }
      case "session_end": {
        const { data: s } = await db
          .from("study_sessions")
          .update({ status: "done", ended_at: ev.at, stats: ev.stats, updated_at: ev.at })
          .eq("id", ev.sessionId)
          .eq("status", "active")
          .select("id")
          .maybeSingle();
        if (s && ev.stats.answered > 0) await bumpStreak(db, userId, new Date(ev.at));
        applied.push(ev.id);
        break;
      }
      case "parking": {
        const { error } = await db
          .from("parking")
          .upsert(
            { id: ev.id, user_id: userId, session_id: ev.sessionId, text: ev.text, created_at: ev.at },
            { onConflict: "id", ignoreDuplicates: true },
          );
        if (error) throw error;
        applied.push(ev.id);
        break;
      }
    }
  }
  return { applied, skipped };
}

export async function bumpStreak(db: ServerSupabase, userId: string, at: Date) {
  const { data: p } = await db.from("profiles").select("streak").eq("user_id", userId).maybeSingle();
  const s = (p?.streak as Streak | null) ?? { current: 0, best: 0, jokers: 1, lastDay: null };
  const next = updateStreak(s, parisDay(at));
  await db
    .from("profiles")
    .update({ streak: { current: next.current, best: next.best, jokers: next.jokers, lastDay: next.lastDay } })
    .eq("user_id", userId);
  return next;
}
