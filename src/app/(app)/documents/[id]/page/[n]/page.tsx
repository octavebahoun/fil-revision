import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/common/page-header";
import { OpenOriginal } from "@/components/courses/open-original";

export const metadata: Metadata = { title: "Lecture" };

/** Lecture du document à une page précise (texte extrait), avec accès au fichier original. */
export default async function SourcePage({ params }: PageProps<"/documents/[id]/page/[n]">) {
  const { id, n } = await params;
  const page = Number(n);
  if (!z.uuid().safeParse(id).success || !Number.isInteger(page) || page < 1) notFound();
  const { supabase } = await requireUser();
  const [{ data: doc }, { data: p }] = await Promise.all([
    supabase.from("documents").select("id, title, page_count, mime").eq("id", id).maybeSingle(),
    supabase.from("document_pages").select("text").eq("document_id", id).eq("page_number", page).maybeSingle(),
  ]);
  if (!doc) notFound();
  const max = doc.page_count ?? page;
  return (
    <>
      <PageHeader
        title={doc.title}
        back={{ href: `/documents/${doc.id}`, label: "Le cours" }}
        subtitle={`Page ${page} sur ${max}`}
      />
      <article
        className="reading-block mb-6 rounded-3xl border bg-card p-5 whitespace-pre-line"
        aria-label={`Texte de la page ${page}`}
      >
        {p?.text?.trim() ? p.text : "Cette page ne contient pas de texte lisible (image ou page vide)."}
      </article>
      <nav aria-label="Pages" className="mb-6 flex items-center justify-between gap-3">
        {page > 1 ? (
          <Link
            href={`/documents/${doc.id}/page/${page - 1}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 font-semibold text-primary"
          >
            <ChevronLeft className="size-5" aria-hidden="true" /> Page {page - 1}
          </Link>
        ) : (
          <span />
        )}
        {page < max ? (
          <Link
            href={`/documents/${doc.id}/page/${page + 1}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 font-semibold text-primary"
          >
            Page {page + 1} <ChevronRight className="size-5" aria-hidden="true" />
          </Link>
        ) : null}
      </nav>
      <OpenOriginal documentId={doc.id} page={page} isPdf={doc.mime === "application/pdf"} />
    </>
  );
}
