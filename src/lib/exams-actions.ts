"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";

const NewExam = z.object({
  subjectId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  date: z.iso.date(),
});

export async function addExamAction(
  _prev: { message: string } | null,
  formData: FormData,
): Promise<{ message: string } | null> {
  const { user, supabase } = await requireUser();
  const parsed = NewExam.safeParse({
    subjectId: formData.get("subjectId"),
    title: formData.get("title") || "Examen",
    date: formData.get("date"),
  });
  if (!parsed.success) return { message: "Choisis une matière et une date." };
  const { error } = await supabase.from("exams").insert({
    user_id: user.id,
    subject_id: parsed.data.subjectId,
    title: parsed.data.title,
    exam_date: parsed.data.date,
  });
  if (error) return { message: "Impossible d'ajouter cet examen." };
  revalidatePath("/examens");
  revalidatePath("/");
  return null;
}

export async function deleteExamAction(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("exams").delete().eq("id", z.uuid().parse(id));
  revalidatePath("/examens");
  revalidatePath("/");
}
