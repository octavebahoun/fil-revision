import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { FicheContent } from "@/lib/content/schemas";
import { PrintButton } from "@/components/common/print-button";

export const metadata: Metadata = { title: "Fiches à imprimer" };

/** Toutes les fiches d'une matière, mises en page pour l'impression ou « Enregistrer en PDF ». */
export default async function ExportPage({ params }: PageProps<"/export/[slug]">) {
  const { slug } = await params;
  const { supabase } = await requireUser();
  const { data: subject } = await supabase.from("subjects").select("id, name").eq("slug", slug).maybeSingle();
  if (!subject) notFound();
  const { data: cards } = await supabase
    .from("cards")
    .select("content, source_pages, documents(title), notions(position, document_id)")
    .eq("subject_id", subject.id)
    .eq("type", "fiche")
    .eq("status", "active")
    .limit(1000);
  const fiches = (cards ?? [])
    .map((c) => ({
      f: FicheContent.safeParse(c.content),
      doc: (c.documents as unknown as { title: string }).title,
      pages: c.source_pages,
      pos: (c.notions as unknown as { position: number }).position,
    }))
    .filter((x) => x.f.success)
    .sort((a, b) => a.doc.localeCompare(b.doc) || a.pos - b.pos);
  return (
    <article className="print-sheet flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 print:block">
        <h1 className="text-2xl font-bold">Fiches · {subject.name}</h1>
        <PrintButton />
      </header>
      {fiches.map(({ f, doc, pages }, i) => {
        const d = f.data!;
        return (
          <section
            key={i}
            className="break-inside-avoid rounded-2xl border p-4 print:rounded-none print:border-0 print:border-b"
          >
            <h2 className="text-lg font-bold">{d.title}</h2>
            <p>{d.explanation}</p>
            <p>
              <strong>Exemple : </strong>
              {d.example}
            </p>
            <p>
              <strong>Question : </strong>
              {d.question}
            </p>
            <p className="text-sm text-muted-foreground">
              Réponse : {d.answer} — Source : {doc}, p. {pages.join(", ")}
            </p>
          </section>
        );
      })}
    </article>
  );
}
