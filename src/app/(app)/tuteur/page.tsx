import type { Metadata } from "next";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/common/page-header";
import { TutorChat } from "@/components/tutor/tutor-chat";

export const metadata: Metadata = { title: "Explique-moi" };

export default async function TuteurPage({ searchParams }: PageProps<"/tuteur">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const notionId = typeof sp.notion === "string" && z.uuid().safeParse(sp.notion).success ? sp.notion : null;
  const { data: notion } = notionId
    ? await supabase.from("notions").select("id, title").eq("id", notionId).maybeSingle()
    : { data: null };
  return (
    <>
      <PageHeader
        title="Explique-moi"
        subtitle={
          notion ? `À propos de « ${notion.title} »` : "Réponses courtes, tirées de tes cours, avec la page source."
        }
        back={notion ? { href: `/notions/${notion.id}`, label: "La notion" } : undefined}
      />
      <TutorChat notionId={notion?.id ?? null} notionTitle={notion?.title ?? null} autoSimple={sp.simple === "1"} />
    </>
  );
}
