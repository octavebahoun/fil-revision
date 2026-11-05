"use client";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult:
    ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function speechRecognitionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

/** Dictée par le navigateur (Chrome, Edge, Safari). Renvoie une fonction d'arrêt. */
export function startBrowserDictation(
  onText: (finalText: string, interim: string) => void,
  onEnd: () => void,
  onError: (msg: string) => void,
) {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) throw new Error("indisponible");
  const rec = new Ctor();
  rec.lang = "fr-FR";
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let finalText = "";
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]!;
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    onText(finalText, interim);
  };
  rec.onend = onEnd;
  rec.onerror = (e) =>
    onError(e.error === "not-allowed" ? "Autorise le micro pour dicter." : "La dictée s'est arrêtée.");
  rec.start();
  return () => rec.stop();
}

/** Dictée de secours : enregistrement puis transcription côté serveur (Meta). */
export async function startRecorderDictation(onDone: (text: string) => void, onError: (msg: string) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    const body = new FormData();
    body.append("audio", blob, "dictee.webm");
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { text?: string };
      onDone(json.text ?? "");
    } catch {
      onError("La transcription n'a pas abouti. Tu peux écrire ton explication.");
    }
  };
  recorder.start();
  // Sécurité : 90 s maximum par enregistrement.
  const timer = setTimeout(() => recorder.state === "recording" && recorder.stop(), 90_000);
  return () => {
    clearTimeout(timer);
    if (recorder.state === "recording") recorder.stop();
  };
}
