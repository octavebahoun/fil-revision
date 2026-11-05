import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { parisDay } from "@/lib/review/streak";
import { planCountdown, remainingMinutes, type PlanDay } from "@/lib/review/planning";

export type PlanView = {
  today: string;
  exams: {
    id: string;
    title: string;
    date: string;
    inDays: number;
    subjectId: string;
    subjectName: string;
    subjectSlug: string;
  }[];
  days: PlanDay[];
  todayBySubject: { subjectId: string; name: string; minutes: number }[];
};

const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Planning du jour, recalculé à partir de l'état réel (un jour sauté est donc pris en compte). */
export async function loadPlan(db: ServerSupabase, userId: string, capMinutes: number): Promise<PlanView> {
  const today = parisDay(new Date());
  const [{ data: exams }, { data: mastery }, { data: fresh }, { data: profile }] = await Promise.all([
    db
      .from("exams")
      .select("id, title, exam_date, subject_id, subjects(name, slug)")
      .gte("exam_date", today)
      .order("exam_date"),
    db.rpc("subject_mastery"),
    db.rpc("review_new_notions", { p_limit: 500 }),
    db.from("profiles").select("plan_state").eq("user_id", userId).maybeSingle(),
  ]);
  const freshBySubject = new Map<string, number>();
  for (const n of fresh ?? []) freshBySubject.set(n.subject_id, (freshBySubject.get(n.subject_id) ?? 0) + 1);
  const remaining: Record<string, number> = {};
  for (const m of mastery ?? []) {
    remaining[m.subject_id] = remainingMinutes({
      newNotions: freshBySubject.get(m.subject_id) ?? 0,
      unmasteredCards: m.total - m.known,
    });
  }
  const state = profile?.plan_state as { day?: string; planned?: number } | null;
  const previousDaily = state?.day === addDays(today, -1) ? state.planned : undefined;
  const examList = (exams ?? []).map((e) => {
    const s = e.subjects as unknown as { name: string; slug: string };
    return {
      id: e.id,
      title: e.title,
      date: e.exam_date,
      inDays: Math.round((Date.parse(`${e.exam_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000),
      subjectId: e.subject_id,
      subjectName: s.name,
      subjectSlug: s.slug,
    };
  });
  const days = planCountdown({
    today,
    exams: examList.map((e) => ({ subjectId: e.subjectId, date: e.date })),
    remaining,
    capMinutes,
    previousDaily,
    horizonDays: 14,
  });
  // Mémorise la charge prévue aujourd'hui (une seule fois par jour) pour lisser demain.
  if (days[0] && state?.day !== today) {
    await db
      .from("profiles")
      .update({ plan_state: { day: today, planned: days[0].total } })
      .eq("user_id", userId);
  }
  const names = new Map(examList.map((e) => [e.subjectId, e.subjectName]));
  const todayBySubject = Object.entries(days[0]?.bySubject ?? {})
    .filter(([, m]) => m > 0)
    .map(([subjectId, minutes]) => ({ subjectId, name: names.get(subjectId) ?? "", minutes }));
  return { today, exams: examList, days, todayBySubject };
}
