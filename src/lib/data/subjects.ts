import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export type SubjectSummary = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  documents: number;
  notions: number;
  processing: number;
  mastery: number | null;
};

/** Maîtrise d'une matière : part des cartes révisables « acquises » (état FSRS Révision, non en retard). */
export async function masteryBySubject(supabase: ServerSupabase): Promise<Map<string, number>> {
  const { data: cards } = await supabase
    .from("cards")
    .select("id, subject_id, type, card_states(state, due, stability)")
    .eq("status", "active")
    .neq("type", "fiche")
    .neq("type", "code_exercise");
  const total = new Map<string, number>();
  const known = new Map<string, number>();
  const now = Date.now();
  for (const c of cards ?? []) {
    total.set(c.subject_id, (total.get(c.subject_id) ?? 0) + 1);
    const st = (c.card_states as unknown as { state: number; due: string; stability: number } | null) ?? null;
    if (st && st.state === 2 && (new Date(st.due).getTime() > now || st.stability >= 3)) {
      known.set(c.subject_id, (known.get(c.subject_id) ?? 0) + 1);
    }
  }
  const out = new Map<string, number>();
  for (const [id, n] of total) out.set(id, Math.round(((known.get(id) ?? 0) / n) * 100));
  return out;
}

export async function listSubjects(supabase: ServerSupabase): Promise<SubjectSummary[]> {
  const [{ data: subjects }, { data: docs }, { data: notions }, mastery] = await Promise.all([
    supabase.from("subjects").select("id, name, slug, kind, position").order("position").order("name"),
    supabase.from("documents").select("subject_id, status"),
    supabase.from("notions").select("subject_id").eq("status", "ready"),
    masteryBySubject(supabase),
  ]);
  return (subjects ?? []).map((s) => {
    const d = (docs ?? []).filter((x) => x.subject_id === s.id);
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      kind: s.kind,
      documents: d.length,
      processing: d.filter((x) => ["uploaded", "extracting", "segmenting", "generating"].includes(x.status)).length,
      notions: (notions ?? []).filter((n) => n.subject_id === s.id).length,
      mastery: mastery.has(s.id) ? mastery.get(s.id)! : null,
    };
  });
}

export function pagesLabel(pages: number[]): string {
  if (!pages.length) return "";
  const sorted = [...pages].sort((a, b) => a - b);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return first === last ? `p. ${first}` : `p. ${first}–${last}`;
}
