import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/common/page-header";
import { MindMap, type MapNode } from "@/components/mindmap/mind-map";

export const metadata: Metadata = { title: "Carte mentale" };

/** Carte mentale : matière → cours → notions, construite à partir du découpage (aucun appel IA). */
export default async function CartePage({ params }: PageProps<"/matieres/[slug]/carte">) {
  const { slug } = await params;
  const { supabase } = await requireUser();
  const { data: subject } = await supabase.from("subjects").select("id, name").eq("slug", slug).maybeSingle();
  if (!subject) notFound();
  const [{ data: docs }, { data: notions }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, kind")
      .eq("subject_id", subject.id)
      .neq("kind", "exercice")
      .order("created_at"),
    supabase
      .from("notions")
      .select("id, title, document_id, position")
      .eq("subject_id", subject.id)
      .eq("status", "ready")
      .order("position")
      .limit(1000),
  ]);
  const root: MapNode = {
    id: subject.id,
    label: subject.name,
    children: (docs ?? [])
      .map((d) => ({
        id: d.id,
        label: d.title,
        children: (notions ?? [])
          .filter((n) => n.document_id === d.id)
          .map((n) => ({ id: n.id, label: n.title, href: `/notions/${n.id}` })),
      }))
      .filter((d) => d.children.length),
  };
  return (
    <>
      <PageHeader
        title="Carte mentale"
        subtitle={subject.name}
        back={{ href: `/matieres/${slug}`, label: "La matière" }}
      />
      {root.children?.length ? (
        <MindMap root={root} />
      ) : (
        <p className="rounded-2xl bg-info-soft px-4 py-3">
          La carte apparaîtra quand les cours de cette matière seront prêts.
        </p>
      )}
    </>
  );
}
