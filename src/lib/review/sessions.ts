import "server-only";
import { randomUUID } from "node:crypto";
import type { ServerSupabase } from "@/lib/supabase/server";
import { buildSession, type CardLite, type Mode, type NewNotion, type SessionItem } from "./build";

export type SessionCard = {
  id: string;
  type: string;
  content: Record<string, unknown>;
  notionId: string;
  notionTitle: string;
  documentId: string;
  documentTitle: string;
  sourcePages: number[];
  ficheId: string | null;
};

/** Crée une session « qui choisit pour moi » et renvoie son identifiant (null si rien à réviser). */
export async function createSession(
  db: ServerSupabase,
  userId: string,
  opts: { mode: Mode; minutes: number; subjectId?: string | null; notionId?: string | null },
): Promise<string | null> {
  let items: SessionItem[] = [];
  if (opts.mode === "notion" && opts.notionId) {
    const { data: cards } = await db
      .from("cards")
      .select("id, type, notion_id, subject_id")
      .eq("notion_id", opts.notionId)
      .eq("status", "active")
      .neq("type", "code_exercise")
      .order("position");
    const fiche = cards?.find((c) => c.type === "fiche");
    items = buildSession({
      mode: "notion",
      minutes: 60,
      due: [],
      fresh: [
        {
          notionId: opts.notionId,
          subjectId: cards?.[0]?.subject_id ?? "",
          ficheId: fiche?.id ?? null,
          cards: (cards ?? [])
            .filter((c) => c.type !== "fiche")
            .map((c) => ({ cardId: c.id, type: c.type, notionId: c.notion_id, subjectId: c.subject_id })),
        },
      ],
    });
  } else {
    const subject = opts.subjectId ?? null;
    const [due, fresh, easy] = await Promise.all([
      db.rpc("review_due_cards", { p_subject: subject ?? undefined, p_limit: 300 }),
      opts.mode === "fatigue"
        ? Promise.resolve({ data: [] })
        : db.rpc("review_new_notions", { p_subject: subject ?? undefined, p_limit: 30 }),
      opts.mode === "fatigue"
        ? db.rpc("review_easy_cards", { p_subject: subject ?? undefined, p_limit: 60 })
        : Promise.resolve({ data: [] }),
    ]);
    // Les matières dont l'examen approche passent en premier (planning à rebours).
    const { data: exams } = await db
      .from("exams")
      .select("subject_id, exam_date")
      .gte("exam_date", new Date().toISOString().slice(0, 10));
    const examRank = new Map<string, string>();
    for (const e of exams ?? [])
      if (!examRank.has(e.subject_id) || e.exam_date < examRank.get(e.subject_id)!)
        examRank.set(e.subject_id, e.exam_date);
    const freshRows = [
      ...((fresh.data ?? []) as { notion_id: string; subject_id: string; fiche_id: string | null }[]),
    ].sort((a, b) => (examRank.get(a.subject_id) ?? "9999").localeCompare(examRank.get(b.subject_id) ?? "9999"));
    const notionIds = freshRows.map((n) => n.notion_id);
    const { data: freshCards } = notionIds.length
      ? await db
          .from("cards")
          .select("id, type, notion_id, subject_id")
          .in("notion_id", notionIds)
          .eq("status", "active")
          .neq("type", "fiche")
          .neq("type", "code_exercise")
          .order("position")
      : { data: [] as { id: string; type: string; notion_id: string; subject_id: string }[] };
    const newNotions: NewNotion[] = freshRows.map((n) => ({
      notionId: n.notion_id,
      subjectId: n.subject_id,
      ficheId: n.fiche_id,
      cards: (freshCards ?? [])
        .filter((c) => c.notion_id === n.notion_id)
        .map((c) => ({ cardId: c.id, type: c.type, notionId: c.notion_id, subjectId: c.subject_id })),
    }));
    const toLite = (r: { card_id: string; type: string; notion_id: string; subject_id: string }): CardLite => ({
      cardId: r.card_id,
      type: r.type,
      notionId: r.notion_id,
      subjectId: r.subject_id,
    });
    items = buildSession({
      mode: opts.mode,
      minutes: opts.minutes,
      due: (due.data ?? []).map(toLite),
      fresh: newNotions,
      easy: (easy.data ?? []).map(toLite),
    });
  }
  if (!items.length) return null;
  const id = randomUUID();
  const { error } = await db.from("study_sessions").insert({
    id,
    user_id: userId,
    mode: opts.mode,
    subject_id: opts.subjectId ?? null,
    planned_minutes: opts.minutes,
    items: items as never,
  });
  if (error) throw error;
  return id;
}

/** Contenu complet des cartes d'une session (pour l'affichage et le hors-ligne). */
export async function loadSessionCards(db: ServerSupabase, items: SessionItem[]): Promise<SessionCard[]> {
  const ids = items.map((i) => i.cardId);
  if (!ids.length) return [];
  const { data } = await db
    .from("cards")
    .select("id, type, content, notion_id, document_id, source_pages, notions(title), documents(title)")
    .in("id", ids);
  const notionIds = [...new Set((data ?? []).map((c) => c.notion_id))];
  const { data: fiches } = notionIds.length
    ? await db
        .from("cards")
        .select("id, notion_id")
        .in("notion_id", notionIds)
        .eq("type", "fiche")
        .eq("status", "active")
    : { data: [] as { id: string; notion_id: string }[] };
  const ficheOf = new Map((fiches ?? []).map((f) => [f.notion_id, f.id]));
  const byId = new Map(
    (data ?? []).map((c) => [
      c.id,
      {
        id: c.id,
        type: c.type,
        content: c.content as Record<string, unknown>,
        notionId: c.notion_id,
        notionTitle: (c.notions as unknown as { title: string } | null)?.title ?? "",
        documentId: c.document_id,
        documentTitle: (c.documents as unknown as { title: string } | null)?.title ?? "",
        sourcePages: c.source_pages,
        ficheId: ficheOf.get(c.notion_id) ?? null,
      } satisfies SessionCard,
    ]),
  );
  return ids.map((id) => byId.get(id)).filter((c): c is SessionCard => Boolean(c));
}
