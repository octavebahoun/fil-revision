import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** État des traitements (lecture via RLS) : documents d'une matière ou un document précis. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "non connecté" }, { status: 401 });
  const documentId = request.nextUrl.searchParams.get("document");
  const subjectId = request.nextUrl.searchParams.get("subject");

  let docsQuery = supabase
    .from("documents")
    .select("id, title, status, error_message, page_count, kind")
    .order("created_at");
  if (documentId) docsQuery = docsQuery.eq("id", documentId);
  else if (subjectId) docsQuery = docsQuery.eq("subject_id", subjectId);
  const { data: docs } = await docsQuery.limit(200);
  const ids = (docs ?? []).map((d) => d.id);

  const notionCounts: Record<string, { total: number; ready: number; error: number }> = {};
  if (ids.length) {
    const { data: notions } = await supabase.from("notions").select("document_id, status").in("document_id", ids);
    for (const n of notions ?? []) {
      const c = (notionCounts[n.document_id] ??= { total: 0, ready: 0, error: 0 });
      c.total++;
      if (n.status === "ready") c.ready++;
      if (n.status === "error") c.error++;
    }
  }
  const { data: pausedJobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("status", "queued")
    .eq("last_error", "budget")
    .limit(1);
  const active = (docs ?? []).some((d) => ["uploaded", "extracting", "segmenting", "generating"].includes(d.status));
  return NextResponse.json({
    active,
    budgetPaused: (pausedJobs ?? []).length > 0,
    documents: (docs ?? []).map((d) => ({ ...d, notions: notionCounts[d.id] ?? { total: 0, ready: 0, error: 0 } })),
  });
}
