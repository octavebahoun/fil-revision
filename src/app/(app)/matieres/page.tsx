import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listSubjects } from "@/lib/data/subjects";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ProgressBar } from "@/components/common/progress-bar";
import { NewSubject } from "@/components/courses/new-subject";

export const metadata: Metadata = { title: "Matières" };

export default async function MatieresPage() {
  const { supabase } = await requireUser();
  const subjects = await listSubjects(supabase);
  const active = subjects.filter((s) => s.documents > 0);
  const upcoming = subjects.filter((s) => s.documents === 0);

  return (
    <>
      <PageHeader title="Tes matières" subtitle={`${active.length} avec des cours · ${upcoming.length} à venir`} />
      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Pas encore de matière"
          text="Crée ta première matière, puis ajoute un cours."
          action={<NewSubject />}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <ul className="flex flex-col gap-3">
            {active.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/matieres/${s.slug}`}
                  className="flex items-center gap-4 rounded-3xl border bg-card p-5 hover:border-primary/50"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="text-lg leading-snug font-semibold">{s.name}</span>
                    <span className="text-base text-muted-foreground">
                      {s.notions} notions · {s.documents} {s.documents > 1 ? "cours" : "cours"}
                      {s.processing ? " · préparation en cours" : ""}
                    </span>
                    {s.mastery ? (
                      <div className="flex items-center gap-3">
                        <ProgressBar value={s.mastery} max={100} label={`Maîtrise de ${s.name}`} className="max-w-48" />
                        <span className="text-sm text-muted-foreground">{s.mastery} % maîtrisé</span>
                      </div>
                    ) : null}
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {upcoming.length ? (
            <section aria-labelledby="a-venir" className="flex flex-col gap-3">
              <h2 id="a-venir" className="text-lg font-semibold text-muted-foreground">
                À venir dans l&apos;année
              </h2>
              <ul className="flex flex-col gap-2">
                {upcoming.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/matieres/${s.slug}`}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-dashed px-4 py-3 text-base hover:border-primary/50"
                    >
                      {s.name}
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <NewSubject />
        </div>
      )}
    </>
  );
}
