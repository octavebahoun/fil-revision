import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { pagesLabel } from "@/lib/data/subjects";
import { PageHeader } from "@/components/common/page-header";
import { MoreDetails } from "@/components/common/more-details";
import { LiveStatus } from "@/components/courses/live-status";
import { DocumentAdmin } from "@/components/courses/document-admin";
import { Button } from "@/components/ui/button";
import { confirmGenerationAction, retryDocumentAction } from "@/lib/courses/actions";
import { formatUsd } from "@/lib/ai/estimate";
import { SubmitButton } from "@/components/common/submit-button";
import { z } from "zod";

export const metadata: Metadata = { title: "Cours" };

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, status, error_message, kind, page_count, filename, estimated_cost_usd, subject_id, subjects(name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (!doc) notFound();
  const [{ data: notions }, { data: allSubjects }] = await Promise.all([
    supabase.from("notions").select("id, title, pages, status").eq("document_id", id).order("position"),
    supabase.from("subjects").select("id, name").order("name"),
  ]);
  const subject = doc.subjects as unknown as { name: string; slug: string };
  const counts = {
    total: notions?.length ?? 0,
    ready: notions?.filter((n) => n.status === "ready").length ?? 0,
    error: notions?.filter((n) => n.status === "error").length ?? 0,
  };
  const retry = retryDocumentAction.bind(null, doc.id);
  const confirm = confirmGenerationAction.bind(null, doc.id);

  return (
    <>
      <PageHeader
        title={doc.title}
        back={{ href: `/matieres/${subject.slug}`, label: subject.name }}
        subtitle={
          doc.kind === "exercice"
            ? "Énoncé d'exercice : aide guidée, sans corrigé d'emblée."
            : `${doc.page_count ?? "?"} pages`
        }
      />
      <div className="mb-6 flex flex-col gap-4">
        <LiveStatus
          documentId={doc.id}
          initial={{
            id: doc.id,
            title: doc.title,
            status: doc.status,
            error_message: doc.error_message,
            notions: counts,
          }}
        />
        {doc.status === "awaiting_confirmation" ? (
          <form action={confirm} className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
            <p>
              Préparer les fiches et les cartes de ce cours coûtera environ{" "}
              <strong>{formatUsd(Number(doc.estimated_cost_usd ?? 0))}</strong> d&apos;IA.
            </p>
            <p className="text-muted-foreground">
              Le plafond quotidien reste actif : au-delà, la suite reprend demain.
            </p>
            <SubmitButton size="lg" pendingLabel="C'est parti…">
              Lancer la préparation
            </SubmitButton>
          </form>
        ) : null}
        {doc.status === "error" || counts.error > 0 ? (
          <form action={retry}>
            <Button type="submit" variant="outline">
              <RotateCcw aria-hidden="true" /> Relancer la préparation
            </Button>
          </form>
        ) : null}
        {doc.kind === "exercice" && doc.status === "ready" ? (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={`/exercices/${doc.id}`}>Commencer l&apos;aide guidée</Link>
          </Button>
        ) : null}
      </div>

      {notions?.length ? (
        <section aria-labelledby="notions" className="mb-8 flex flex-col gap-3">
          <h2 id="notions" className="text-lg font-semibold">
            Notions ({notions.length})
          </h2>
          <ol className="flex flex-col gap-2">
            {notions.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notions/${n.id}`}
                  className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:border-primary/50"
                >
                  <span className="min-w-0 flex-1 leading-snug">{n.title}</span>
                  <span className="shrink-0 text-sm text-muted-foreground">{pagesLabel(n.pages)}</span>
                  {n.status !== "ready" ? (
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {n.status === "error" ? "à revoir" : "…"}
                    </span>
                  ) : null}
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {doc.page_count ? (
        <Link
          href={`/documents/${doc.id}/page/1`}
          className="mb-6 inline-flex min-h-11 items-center gap-2 font-semibold text-primary"
        >
          <ExternalLink className="size-5" aria-hidden="true" /> Lire le document
        </Link>
      ) : null}

      <MoreDetails label="Gérer ce cours">
        <DocumentAdmin
          documentId={doc.id}
          kind={doc.kind as "cours" | "exercice" | "ressource"}
          subjectId={doc.subject_id}
          subjectSlug={subject.slug}
          subjects={allSubjects ?? []}
        />
      </MoreDetails>
    </>
  );
}
