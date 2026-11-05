import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSession, loadSessionCards } from "@/lib/review/sessions";
import { parisDay } from "@/lib/review/streak";
import type { SessionItem } from "@/lib/review/build";

/**
 * Pack du jour pour le hors-ligne : une session de 15 min préparée à l'avance (cartes dues + nouveautés),
 * gardée dans IndexedDB. Créée une seule fois par jour, réutilisée tant qu'elle n'est pas terminée.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "non connecté" }, { status: 401 });
  const day = parisDay(new Date());
  const { data: existing } = await supabase
    .from("study_sessions")
    .select("id, mode, planned_minutes, items, position, status")
    .eq("stats->>pack", day)
    .eq("status", "active")
    .maybeSingle();
  let session = existing;
  if (!session) {
    const id = await createSession(supabase, auth.user.id, { mode: "mix", minutes: 15 });
    if (!id) return NextResponse.json({ session: null, cards: [] });
    await supabase
      .from("study_sessions")
      .update({ stats: { pack: day } })
      .eq("id", id);
    const { data } = await supabase
      .from("study_sessions")
      .select("id, mode, planned_minutes, items, position, status")
      .eq("id", id)
      .single();
    session = data;
  }
  if (!session) return NextResponse.json({ session: null, cards: [] });
  const items = (session.items as SessionItem[]) ?? [];
  const cards = await loadSessionCards(supabase, items);
  return NextResponse.json({
    day,
    session: {
      id: session.id,
      mode: session.mode,
      plannedMinutes: session.planned_minutes,
      items,
      position: session.position,
      status: "active",
    },
    cards,
  });
}
