import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, Play, Map as MapIcon, GraduationCap } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { masteryBySubject } from "@/lib/data/subjects";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { MoreDetails } from "@/components/common/more-details";
import { StatusBadge } from "@/components/common/status-badge";
import { UploadZone } from "@/components/courses/upload-zone";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: PageProps<"/matieres/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("subjects").select("name").eq("slug", slug).maybeSingle();
  return { title: data?.name ?? "Matière" };
}

const KIND_LABEL: Record<string, string> = { cours: "Cours", exercice: "Énoncé d'exercice", ressource: "Ressource" };

export default async function MatierePage({ params }: PageProps<"/matieres/[slug]">) {
  const { slug } = await params;
  const { supabase } = await requireUser();
  const { data: subject } = await supabase.from("subjects").select("id, name, kind").eq("slug", slug).maybeSingle();
  if (!subject) notFound();
  const [{ data: docs }, { count: notionCount }, mastery] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, status, kind, page_count")
      .eq("subject_id", subject.id)
      .order("created_at"),
    supabase
      .from("notions")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", subject.id)
      .eq("status", "ready"),
    masteryBySubject(supabase),
  ]);
  const hasNotions = (notionCount ?? 0) > 0;
  const m = mastery.get(subject.id);

  return (
    <>
      <PageHeader
        title={subject.name}
        back={{ href: "/matieres", label: "Matières" }}
        subtitle={
          docs?.length
            ? `${notionCount ?? 0} notions${m !== undefined ? ` · ${m} % maîtrisé` : ""}`
            : "Pas encore de cours : cette matière arrive plus tard dans l'année."
        }
      />
      {hasNotions ? (
        <Button asChild size="lg" className="mb-8 w-full sm:w-auto">
          <Link href={`/session/nouvelle?matiere=${slug}`}>
            <Play aria-hidden="true" /> Réviser cette matière
          </Link>
        </Button>
      ) : null}

      {docs?.length ? (
        <section aria-labelledby="cours" className="mb-8 flex flex-col gap-3">
          <h2 id="cours" className="text-lg font-semibold">
            Cours
          </h2>
          <ul className="flex flex-col gap-3">
            {docs.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/documents/${d.id}`}
                  className="flex items-center gap-4 rounded-3xl border bg-card p-4 hover:border-primary/50"
                >
                  <FileText className="size-6 shrink-0 text-primary" aria-hidden="true" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="leading-snug font-semibold">{d.title}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {KIND_LABEL[d.kind]}
                      {d.page_count ? ` · ${d.page_count} pages` : ""}
                      {d.status !== "ready" ? <StatusBadge status={d.status} /> : null}
                    </span>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="mb-8">
          <EmptyState
            icon={FileText}
            title="Aucun cours pour l'instant"
            text="Ajoute ton premier support : Fil prépare les fiches et les cartes pour toi."
          />
        </div>
      )}

      {hasNotions ? (
        <nav aria-label="Autres outils" className="mb-8 flex flex-col gap-2">
          <Link
            href={`/matieres/${slug}/carte`}
            className="flex min-h-12 items-center gap-3 rounded-2xl px-3 hover:bg-muted"
          >
            <MapIcon className="size-5 text-primary" aria-hidden="true" /> Carte mentale
          </Link>
          <Link
            href={`/examens/blanc?matiere=${slug}`}
            className="flex min-h-12 items-center gap-3 rounded-2xl px-3 hover:bg-muted"
          >
            <GraduationCap className="size-5 text-primary" aria-hidden="true" /> Examen blanc
          </Link>
        </nav>
      ) : null}

      {docs?.length ? (
        <MoreDetails label="Ajouter un cours">
          <UploadZone subjectId={subject.id} />
        </MoreDetails>
      ) : (
        <UploadZone subjectId={subject.id} />
      )}
    </>
  );
}
