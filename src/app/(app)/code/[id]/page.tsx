import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { CodeExerciseContent } from "@/lib/content/schemas";
import { PageHeader } from "@/components/common/page-header";
import { CodeRunner } from "@/components/code/code-runner";

export const metadata: Metadata = { title: "Exercice de code" };

export default async function CodePage({ params }: PageProps<"/code/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser();
  const { data: card } = await supabase
    .from("cards")
    .select("id, content, notion_id, notions(title)")
    .eq("id", id)
    .eq("type", "code_exercise")
    .maybeSingle();
  const ex = card ? CodeExerciseContent.safeParse(card.content) : null;
  if (!card || !ex?.success) notFound();
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <PageHeader
        title={ex.data.title}
        subtitle={(card.notions as unknown as { title: string }).title}
        back={{ href: `/notions/${card.notion_id}`, label: "La notion" }}
      />
      <CodeRunner cardId={card.id} exercise={ex.data} nonce={nonce} />
    </>
  );
}
