import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircleQuestion, PenLine, Play } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { FicheContent } from "@/lib/content/schemas";
import { PageHeader } from "@/components/common/page-header";
import { MoreDetails } from "@/components/common/more-details";
import { FicheView } from "@/components/cards/fiche-view";
import { SourceLink } from "@/components/cards/source-link";
import { CardManager } from "@/components/cards/card-manager";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Notion" };

export default async function NotionPage({ params }: PageProps<"/notions/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser();
  const { data: notion } = await supabase
    .from("notions")
    .select("id, title, pages, status, error_message, document_id, documents(title), subjects(name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (!notion) notFound();
  const { data: cards } = await supabase
    .from("cards")
    .select("id, type, content, status, edited, source_pages")
    .eq("notion_id", id)
    .neq("status", "removed")
    .order("position");
  const ficheRow = cards?.find((c) => c.type === "fiche" && c.status === "active");
  const fiche = ficheRow ? FicheContent.safeParse(ficheRow.content) : null;
  const others = (cards ?? []).filter((c) => c.type !== "fiche");
  const doc = notion.documents as unknown as { title: string };
  const subject = notion.subjects as unknown as { name: string; slug: string };

  return (
    <>
      <PageHeader
        title={notion.title}
        back={{ href: `/documents/${notion.document_id}`, label: doc.title }}
        subtitle={subject.name}
      />
      <div className="mb-6 flex flex-col gap-4">
        {fiche?.success ? (
          <FicheView
            fiche={fiche.data}
            footer={<SourceLink documentId={notion.document_id} pages={ficheRow!.source_pages} title={doc.title} />}
          />
        ) : (
          <p className="rounded-2xl bg-info-soft px-4 py-3">
            {notion.status === "error"
              ? (notion.error_message ?? "La fiche n'a pas pu être vérifiée.")
              : "La fiche est en préparation. Elle apparaît ici dès qu'elle est prête."}
          </p>
        )}
        {others.length ? (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={`/session/nouvelle?notion=${notion.id}`}>
              <Play aria-hidden="true" /> Réviser cette notion
            </Link>
          </Button>
        ) : null}
      </div>
      <nav aria-label="Approfondir" className="mb-6 flex flex-col gap-1">
        <Link
          href={`/tuteur?notion=${notion.id}`}
          className="flex min-h-12 items-center gap-3 rounded-2xl px-3 hover:bg-muted"
        >
          <MessageCircleQuestion className="size-5 text-primary" aria-hidden="true" /> Explique-moi
        </Link>
        <Link
          href={`/feynman/${notion.id}`}
          className="flex min-h-12 items-center gap-3 rounded-2xl px-3 hover:bg-muted"
        >
          <PenLine className="size-5 text-primary" aria-hidden="true" /> Je l&apos;explique avec mes mots
        </Link>
      </nav>
      {cards?.length ? (
        <MoreDetails label={`Mes contenus (${cards.length})`}>
          <CardManager cards={(cards ?? []).map((c) => ({ ...c, content: c.content as Record<string, unknown> }))} />
        </MoreDetails>
      ) : null}
    </>
  );
}
