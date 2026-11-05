"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createSession } from "./sessions";
import { createMockExam, finishMockExam } from "./exam";

const Start = z.object({
  mode: z.enum(["mix", "fiches", "flashcards", "quiz", "fatigue", "notion"]).default("mix"),
  minutes: z.coerce
    .number()
    .int()
    .refine((m) => [5, 10, 15, 25].includes(m))
    .default(10),
  matiere: z.string().max(120).optional(),
  notion: z.uuid().optional(),
});

/** « Réviser maintenant » : construit la session et l'ouvre. */
export async function startSessionAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const parsed = Start.safeParse({
    mode: formData.get("mode") ?? undefined,
    minutes: formData.get("minutes") ?? undefined,
    matiere: formData.get("matiere") || undefined,
    notion: formData.get("notion") || undefined,
  });
  if (!parsed.success) redirect("/reviser?erreur=1");
  const { mode, matiere, notion } = parsed.data;
  const minutes = mode === "fatigue" ? 5 : parsed.data.minutes;
  let subjectId: string | null = null;
  if (matiere) {
    const { data } = await supabase.from("subjects").select("id").eq("slug", matiere).maybeSingle();
    subjectId = data?.id ?? null;
  }
  const id = await createSession(supabase, user.id, {
    mode: notion ? "notion" : mode,
    minutes,
    subjectId,
    notionId: notion ?? null,
  });
  if (!id) redirect(`/reviser?vide=1${matiere ? `&matiere=${matiere}` : ""}`);
  redirect(`/session/${id}`);
}

const MockExam = z.object({
  matiere: z.string().min(1).max(120),
  count: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30].includes(n))
    .default(10),
  timer: z.coerce
    .number()
    .int()
    .refine((n) => [0, 10, 20, 30, 45, 60].includes(n))
    .default(0),
});

/** Examen blanc : sans minuteur par défaut. */
export async function startMockExamAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const parsed = MockExam.safeParse({
    matiere: formData.get("matiere"),
    count: formData.get("count") ?? undefined,
    timer: formData.get("timer") ?? undefined,
  });
  if (!parsed.success) redirect("/matieres");
  const { data: subject } = await supabase.from("subjects").select("id").eq("slug", parsed.data.matiere).maybeSingle();
  if (!subject) redirect("/matieres");
  const id = await createMockExam(supabase, user.id, {
    subjectId: subject.id,
    count: parsed.data.count,
    timerMinutes: parsed.data.timer || null,
  });
  if (!id) redirect(`/examens/blanc?matiere=${parsed.data.matiere}&vide=1`);
  redirect(`/session/${id}`);
}

export async function finishMockExamAction(sessionId: string) {
  const { user, supabase } = await requireUser();
  return finishMockExam(supabase, user.id, z.uuid().parse(sessionId));
}
