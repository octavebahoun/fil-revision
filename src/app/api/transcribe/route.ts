import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const maxDuration = 60;

/**
 * Dictée de secours (Firefox…) : transcription par Meta (muse-voice-transcribe-1.0, API compatible OpenAI).
 * Audio limité à 4 Mo (≈ 1 à 2 minutes), jamais stocké.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "non connecté" }, { status: 401 });
  if (!(await rateLimit("ai", data.user.id))) return NextResponse.json({ error: "trop de demandes" }, { status: 429 });
  const e = env();
  if (!e.META_API_KEY) return NextResponse.json({ error: "indisponible" }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (
    !(audio instanceof Blob) ||
    audio.size === 0 ||
    audio.size > 4 * 1024 * 1024 ||
    !audio.type.startsWith("audio/")
  ) {
    return NextResponse.json({ error: "audio invalide" }, { status: 400 });
  }
  const body = new FormData();
  body.append("file", audio, "dictee.webm");
  body.append("model", "muse-voice-transcribe-1.0");
  body.append("language", "fr");
  const res = await fetch(`${e.META_BASE_URL.replace(/\/$/, "")}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${e.META_API_KEY}` },
    body,
    signal: AbortSignal.timeout(50_000),
  }).catch(() => null);
  if (!res?.ok) {
    log("warn", "transcribe_failed", { status: res?.status ?? 0 });
    return NextResponse.json({ error: "transcription impossible" }, { status: 502 });
  }
  const json = (await res.json().catch(() => ({}))) as { text?: string };
  return NextResponse.json({ text: (json.text ?? "").slice(0, 3000) });
}
