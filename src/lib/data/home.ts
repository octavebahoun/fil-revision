import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { displayStreak, parisDay, type Streak } from "@/lib/review/streak";
import type { SessionItem } from "@/lib/review/build";

export type HomeData = {
  activeSession: { id: string; position: number; total: number } | null;
  due: number;
  fresh: number;
  streak: { current: number; jokers: number };
  mastery: { id: string; name: string; slug: string; percent: number }[];
  nextExam: { title: string; subject: string; date: string; inDays: number } | null;
  hasContent: boolean;
};

export async function loadHome(db: ServerSupabase, userId: string): Promise<HomeData> {
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const today = parisDay(new Date());
  const [sess, mastery, fresh, profile, subjects, exams] = await Promise.all([
    db
      .from("study_sessions")
      .select("id, position, items")
      .eq("status", "active")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.rpc("subject_mastery"),
    db.rpc("review_new_notions", { p_limit: 200 }),
    db.from("profiles").select("streak").eq("user_id", userId).maybeSingle(),
    db.from("subjects").select("id, name, slug"),
    db.from("exams").select("title, exam_date, subjects(name)").gte("exam_date", today).order("exam_date").limit(1),
  ]);
  const items = (sess.data?.items as SessionItem[] | undefined) ?? [];
  const active =
    sess.data && sess.data.position < items.length
      ? { id: sess.data.id, position: sess.data.position, total: items.length }
      : null;
  const m = mastery.data ?? [];
  const names = new Map((subjects.data ?? []).map((s) => [s.id, s]));
  const s = (profile.data?.streak as Streak | null) ?? { current: 0, best: 0, jokers: 1, lastDay: null };
  const exam = exams.data?.[0];
  return {
    activeSession: active,
    due: m.reduce((n, r) => n + r.due, 0),
    fresh: (fresh.data ?? []).length,
    streak: { current: displayStreak(s, today), jokers: s.jokers },
    mastery: m
      .filter((r) => names.has(r.subject_id) && r.total > 0)
      .map((r) => ({
        id: r.subject_id,
        name: names.get(r.subject_id)!.name,
        slug: names.get(r.subject_id)!.slug,
        percent: Math.round((r.known / r.total) * 100),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    nextExam: exam
      ? {
          title: exam.title,
          subject: (exam.subjects as unknown as { name: string } | null)?.name ?? "",
          date: exam.exam_date,
          inDays: Math.round(
            (Date.parse(`${exam.exam_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
          ),
        }
      : null,
    hasContent: m.length > 0,
  };
}
