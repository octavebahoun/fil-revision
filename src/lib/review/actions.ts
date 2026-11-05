"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createSession } from "./sessions";

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
