import "server-only";
import { randomUUID } from "node:crypto";
import type { ServerSupabase } from "@/lib/supabase/server";
import { seededShuffle } from "./answer";
import { QUIZ, type SessionItem } from "./build";

/** Examen blanc : un quiz mixte, une ou deux questions par notion, dans un ordre mélangé. */
export async function createMockExam(
  db: ServerSupabase,
  userId: string,
  opts: { subjectId: string; count: number; timerMinutes: number | null },
): Promise<string | null> {
  const { data: cards } = await db
    .from("cards")
    .select("id, type, notion_id")
    .eq("subject_id", opts.subjectId)
    .eq("status", "active")
    .in("type", [...QUIZ])
    .limit(1000);
  if (!cards?.length) return null;
  const seed = randomUUID();
  const byNotion = new Map<string, typeof cards>();
  for (const c of seededShuffle(cards, seed)) byNotion.set(c.notion_id, [...(byNotion.get(c.notion_id) ?? []), c]);
  // Tour de table : une question par notion, puis une deuxième si besoin.
  const picked: typeof cards = [];
  for (let round = 0; round < 2 && picked.length < opts.count; round++) {
    for (const list of byNotion.values()) {
      if (picked.length >= opts.count) break;
      if (list[round]) picked.push(list[round]!);
    }
  }
  const items: SessionItem[] = seededShuffle(picked, seed).map((c) => ({
    cardId: c.id,
    type: c.type,
    notionId: c.notion_id,
    fresh: false,
  }));
  const sessionId = randomUUID();
  const { error } = await db.from("study_sessions").insert({
    id: sessionId,
    user_id: userId,
    mode: "exam",
    subject_id: opts.subjectId,
    planned_minutes: opts.timerMinutes ?? Math.max(5, Math.round(items.length * 0.6)),
    items: items as never,
    timer: opts.timerMinutes ? { minutes: opts.timerMinutes } : null,
  });
  if (error) throw error;
  await db
    .from("mock_exams")
    .insert({ user_id: userId, subject_id: opts.subjectId, session_id: sessionId, timer_minutes: opts.timerMinutes });
  return sessionId;
}

export type ExamResult = {
  total: number;
  answered: number;
  correct: number;
  weak: { notionId: string; title: string }[];
};

/** Bilan : score et notions faibles ; leurs cartes reviennent tout de suite dans les révisions. */
export async function finishMockExam(
  db: ServerSupabase,
  userId: string,
  sessionId: string,
): Promise<ExamResult | null> {
  const { data: session } = await db.from("study_sessions").select("id, items, mode").eq("id", sessionId).maybeSingle();
  if (!session || session.mode !== "exam") return null;
  const items = (session.items as SessionItem[]) ?? [];
  const { data: reviews } = await db
    .from("reviews")
    .select("card_id, correct, outcome")
    .eq("session_id", sessionId)
    .eq("undone", false);
  const answered = (reviews ?? []).filter((r) => r.outcome === "rated");
  const wrongCards = new Set(answered.filter((r) => r.correct === false).map((r) => r.card_id));
  const weakIds = [...new Set(items.filter((i) => wrongCards.has(i.cardId)).map((i) => i.notionId))];
  const { data: notions } = weakIds.length
    ? await db.from("notions").select("id, title").in("id", weakIds)
    : { data: [] };
  if (weakIds.length) {
    const now = new Date().toISOString();
    const { data: weakCards } = await db
      .from("cards")
      .select("id")
      .in("notion_id", weakIds)
      .eq("status", "active")
      .neq("type", "fiche");
    const ids = (weakCards ?? []).map((c) => c.id);
    if (ids.length) await db.from("card_states").update({ due: now }).in("card_id", ids);
  }
  const result: ExamResult = {
    total: items.length,
    answered: answered.length,
    correct: answered.filter((r) => r.correct === true).length,
    weak: (notions ?? []).map((n) => ({ notionId: n.id, title: n.title })),
  };
  await db
    .from("mock_exams")
    .update({ result: result as never, finished_at: new Date().toISOString() })
    .eq("session_id", sessionId);
  return result;
}
