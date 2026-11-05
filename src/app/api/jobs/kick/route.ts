import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runWorker } from "@/lib/jobs/run";

export const maxDuration = 300;

/**
 * Relance douce des traitements de l'utilisateur connecté (appelée par l'écran de suivi).
 * Le travail se fait après la réponse ; plusieurs relances simultanées sont sans danger (verrous en base).
 */
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "non connecté" }, { status: 401 });
  const userId = data.user.id;
  after(() => runWorker({ userId, budgetMs: 200_000, concurrency: 4 }).then(() => undefined));
  return NextResponse.json({ ok: true });
}
