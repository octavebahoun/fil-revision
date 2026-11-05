import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, GraduationCap, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { loadPlan } from "@/lib/data/plan";
import { parseSettings } from "@/lib/settings";
import { deleteExamAction } from "@/lib/exams-actions";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { MoreDetails } from "@/components/common/more-details";
import { AddExam } from "@/components/exams/add-exam";
import { DailyCap } from "@/components/exams/daily-cap";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Examens" };

const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const short = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", timeZone: "UTC" });

export default async function ExamensPage() {
  const { user, supabase } = await requireUser();
  const [{ data: profile }, { data: subjects }] = await Promise.all([
    supabase.from("profiles").select("settings").eq("user_id", user.id).maybeSingle(),
    supabase.from("subjects").select("id, name, slug").order("name"),
  ]);
  const settings = parseSettings(profile?.settings);
  const plan = await loadPlan(supabase, user.id, settings.dailyCapMinutes);

  return (
    <>
      <PageHeader title="Examens" subtitle="Tes dates, et un planning à rebours qui ne déborde jamais." />
      {plan.todayBySubject.length ? (
        <section className="mb-6 flex flex-col gap-2 rounded-3xl border bg-card p-5" aria-labelledby="aujourdhui">
          <h2 id="aujourdhui" className="text-lg font-semibold">
            Aujourd&apos;hui
          </h2>
          <ul className="flex flex-col gap-1">
            {plan.todayBySubject.map((s) => (
              <li key={s.subjectId}>
                {s.minutes} min · {s.name}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Si tu sautes un jour, le retard est étalé doucement sur les jours suivants.
          </p>
        </section>
      ) : null}

      {plan.exams.length ? (
        <ul className="mb-6 flex flex-col gap-3">
          {plan.exams.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-3xl border bg-card p-4">
              <CalendarDays className="size-6 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">
                  {e.title} · {e.subjectName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {fmt.format(new Date(`${e.date}T00:00:00Z`))} ·{" "}
                  {e.inDays === 0 ? "aujourd'hui" : e.inDays === 1 ? "demain" : `dans ${e.inDays} jours`}
                </span>
              </div>
              <Link
                href={`/examens/blanc?matiere=${e.subjectSlug}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-primary"
                aria-label={`Examen blanc : ${e.subjectName}`}
              >
                <GraduationCap className="size-5" aria-hidden="true" />
              </Link>
              <form action={deleteExamAction.bind(null, e.id)}>
                <Button variant="ghost" size="icon" aria-label={`Supprimer l'examen ${e.title}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mb-6">
          <EmptyState
            icon={CalendarDays}
            title="Aucun examen prévu"
            text="Ajoute tes dates : Fil répartira tes révisions jusqu'au jour J."
          />
        </div>
      )}

      {plan.days.length > 1 ? (
        <MoreDetails label="Voir les 14 prochains jours">
          <ol className="flex flex-col gap-1">
            {plan.days.map((d) => (
              <li key={d.day} className="flex justify-between gap-3 rounded-xl px-2 py-1">
                <span>{short.format(new Date(`${d.day}T00:00:00Z`))}</span>
                <span className="text-muted-foreground">{d.total ? `${d.total} min` : "repos"}</span>
              </li>
            ))}
          </ol>
        </MoreDetails>
      ) : null}

      <section className="mt-6 flex flex-col gap-4" aria-labelledby="ajouter">
        <h2 id="ajouter" className="text-lg font-semibold">
          Ajouter un examen
        </h2>
        {subjects?.length ? <AddExam subjects={subjects} today={plan.today} /> : <p>Crée d&apos;abord une matière.</p>}
        <DailyCap />
      </section>
    </>
  );
}
