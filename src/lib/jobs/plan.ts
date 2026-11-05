import type { AdminSupabase } from "@/lib/supabase/admin";
import { enqueueJob } from "./queue";

/** Lance la génération des notions pas encore prêtes d'un document (idempotent). */
export async function enqueueGeneration(db: AdminSupabase, userId: string, documentId: string): Promise<number> {
  const { data: notions, error } = await db
    .from("notions")
    .select("id, content_hash, status")
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .order("position");
  if (error) throw error;
  const todo = (notions ?? []).filter((n) => n.status !== "ready");
  for (const n of todo) {
    await enqueueJob(db, {
      userId,
      type: "generate_notion",
      payload: { notionId: n.id },
      dedupeKey: `gen:${n.id}:${n.content_hash}`,
      total: 4,
    });
  }
  await db
    .from("documents")
    .update({ status: todo.length ? "generating" : "ready" })
    .eq("id", documentId)
    .eq("user_id", userId);
  return todo.length;
}
