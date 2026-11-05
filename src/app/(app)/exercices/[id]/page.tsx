import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { GuideOutput, FeedbackOutput } from "@/lib/ai/tasks/exercise";
import { PageHeader } from "@/components/common/page-header";
import { GuidedExercise } from "@/components/exercises/guided-exercise";

export const metadata: Metadata = { title: "Aide guidée" };

export default async function ExercicePage({ params }: PageProps<"/exercices/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser();
  const [{ data: doc }, { data: guide }] = await Promise.all([
    supabase.from("documents").select("id, title, status").eq("id", id).maybeSingle(),
    supabase.from("exercise_guides").select("id, steps").eq("document_id", id).maybeSingle(),
  ]);
  if (!doc) notFound();
  const parsed = guide ? GuideOutput.safeParse(guide.steps) : null;
  const { data: progress } = guide
    ? await supabase
        .from("exercise_progress")
        .select("step_index, hints_shown, answer, feedback")
        .eq("guide_id", guide.id)
    : { data: [] };
  const initial = Object.fromEntries(
    (progress ?? []).map((r) => {
      const fb = FeedbackOutput.safeParse(r.feedback);
      return [r.step_index, { hints: r.hints_shown, answer: r.answer ?? "", feedback: fb.success ? fb.data : null }];
    }),
  );
  return (
    <>
      <PageHeader
        title={doc.title}
        subtitle="Aide guidée : pas de corrigé d'emblée, des indices quand tu en as besoin."
        back={{ href: `/documents/${doc.id}`, label: "L'énoncé" }}
      />
      {guide && parsed?.success ? (
        <GuidedExercise guideId={guide.id} guide={parsed.data} initial={initial} />
      ) : (
        <p className="rounded-2xl bg-info-soft px-4 py-3">
          L&apos;aide guidée est en préparation. Reviens dans une minute.
        </p>
      )}
    </>
  );
}
