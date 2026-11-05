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

/** Maîtrise d'une matière : part des cartes révisables « acquises » (calcul en base, sans limite de lignes). */
export async function masteryBySubject(supabase: ServerSupabase): Promise<Map<string, number>> {
  const { data } = await supabase.rpc("subject_mastery");
  const out = new Map<string, number>();
  for (const r of data ?? []) if (r.total > 0) out.set(r.subject_id, Math.round((r.known / r.total) * 100));
  return out;
}

export async function listSubjects(supabase: ServerSupabase): Promise<SubjectSummary[]> {
  const [{ data: subjects }, { data: overview }, mastery] = await Promise.all([
    supabase.from("subjects").select("id, name, slug, kind, position").order("position").order("name"),
    supabase.rpc("subject_overview"),
    masteryBySubject(supabase),
  ]);
  const ov = new Map((overview ?? []).map((o) => [o.subject_id, o]));
  return (subjects ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    kind: s.kind,
    documents: ov.get(s.id)?.documents ?? 0,
    processing: ov.get(s.id)?.processing ?? 0,
    notions: ov.get(s.id)?.notions ?? 0,
    mastery: mastery.has(s.id) ? mastery.get(s.id)! : null,
  }));
}

export function pagesLabel(pages: number[]): string {
  if (!pages.length) return "";
  const sorted = [...pages].sort((a, b) => a - b);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return first === last ? `p. ${first}` : `p. ${first}–${last}`;
}
