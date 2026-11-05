import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toAnkiCsv, type AnkiRow } from "@/lib/export/anki";
import { slugify } from "@/lib/text/normalize";

/** Flashcards (et vocabulaire) d'une matière au format CSV importable dans Anki. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "non connecté" }, { status: 401 });
  const slug = request.nextUrl.searchParams.get("matiere") ?? "";
  const { data: subject } = await supabase.from("subjects").select("id, name").eq("slug", slug).maybeSingle();
  if (!subject) return NextResponse.json({ error: "matière introuvable" }, { status: 404 });
  const rows: AnkiRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("cards")
      .select("type, content, notions(title)")
      .eq("subject_id", subject.id)
      .eq("status", "active")
      .in("type", ["flashcard", "vocab", "phrase"])
      .order("created_at")
      .range(from, from + 999);
    for (const c of data ?? []) {
      const k = c.content as Record<string, string>;
      const notion = (c.notions as unknown as { title: string } | null)?.title ?? "";
      const tags = ["Fil", slugify(subject.name), slugify(notion)].filter(Boolean);
      if (c.type === "flashcard") rows.push({ front: k.front ?? "", back: k.back ?? "", tags });
      else rows.push({ front: k.en ?? "", back: [k.fr, k.example || k.context].filter(Boolean).join("<br>"), tags });
    }
    if (!data || data.length < 1000) break;
  }
  return new NextResponse(toAnkiCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="fil-${slugify(subject.name)}-anki.csv"`,
      "cache-control": "no-store",
    },
  });
}
