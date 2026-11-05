import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SyncBody } from "@/lib/review/events";
import { applyEvents } from "@/lib/review/apply";
import { log, errorCode } from "@/lib/log";

/** Synchronisation des événements d'apprentissage (sauvegarde continue, retour du réseau). */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "non connecté" }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 512_000) return NextResponse.json({ error: "trop gros" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "format" }, { status: 400 });
  }
  const parsed = SyncBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "format" }, { status: 400 });
  try {
    const res = await applyEvents(supabase, auth.user.id, parsed.data.events);
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    log("error", "sync_failed", { code: errorCode(err) });
    return NextResponse.json({ error: "temporaire" }, { status: 503 });
  }
}
