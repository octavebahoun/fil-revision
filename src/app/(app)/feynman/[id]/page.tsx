import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { FicheContent } from "@/lib/content/schemas";
import { PageHeader } from "@/components/common/page-header";
import { FeynmanPractice } from "@/components/feynman/feynman-practice";

export const metadata: Metadata = { title: "Méthode Feynman" };

export default async function FeynmanPage({ params }: PageProps<"/feynman/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser();
  const { data: notion } = await supabase.from("notions").select("id, title").eq("id", id).maybeSingle();
  if (!notion) notFound();
  const { data: fiche } = await supabase
    .from("cards")
    .select("content")
    .eq("notion_id", id)
    .eq("type", "fiche")
    .eq("status", "active")
    .maybeSingle();
  const parsed = fiche ? FicheContent.safeParse(fiche.content) : null;
  return (
    <>
      <PageHeader
        title="Je l'explique avec mes mots"
        subtitle={notion.title}
        back={{ href: `/notions/${notion.id}`, label: "La notion" }}
      />
      <FeynmanPractice
        notionId={notion.id}
        prompt={parsed?.success ? parsed.data.question : `Qu'est-ce que « ${notion.title} » ?`}
      />
    </>
  );
}
