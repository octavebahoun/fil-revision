"use client";
import { useId, useRef, useState, useTransition } from "react";
import { Mic, Square, CheckCircle2, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { evaluateFeynmanAction } from "@/lib/feynman/actions";
import type { FeynmanOutput } from "@/lib/ai/tasks/feynman";
import { speechRecognitionAvailable, startBrowserDictation, startRecorderDictation } from "./dictation";

/** Méthode Feynman : j'explique avec mes mots (écrit ou dictée), l'IA dit ce qui est juste et ce qui manque. */
export function FeynmanPractice({ notionId, prompt }: { notionId: string; prompt: string }) {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<FeynmanOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const stopRef = useRef<(() => void) | null>(null);
  const id = useId();

  const toggleDictation = async () => {
    setError(null);
    if (listening) {
      stopRef.current?.();
      setListening(false);
      return;
    }
    try {
      if (speechRecognitionAvailable()) {
        stopRef.current = startBrowserDictation(
          (finalText, partial) => {
            if (finalText) setText((t) => (t ? `${t} ${finalText.trim()}` : finalText.trim()));
            setInterim(partial);
          },
          () => {
            setListening(false);
            setInterim("");
          },
          (msg) => setError(msg),
        );
      } else {
        stopRef.current = await startRecorderDictation(
          (t) => {
            setText((prev) => (prev ? `${prev} ${t}` : t));
            setListening(false);
          },
          (msg) => {
            setError(msg);
            setListening(false);
          },
        );
      }
      setListening(true);
    } catch {
      setError("Le micro n'est pas disponible. Tu peux écrire ton explication.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="reading-block rounded-2xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground">
        {prompt}
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="font-semibold">
          Explique avec tes mots, comme à un ami
        </label>
        <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={3000} />
        {interim ? (
          <p className="text-muted-foreground" aria-live="polite">
            {interim}…
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={toggleDictation} aria-pressed={listening}>
          {listening ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
          {listening ? "Arrêter la dictée" : "Dicter"}
        </Button>
        <Button
          size="lg"
          disabled={pending || text.trim().length < 15}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await evaluateFeynmanAction(notionId, text);
              if (res.ok) setResult(res.result);
              else setError(res.message);
            })
          }
        >
          {pending ? "Je relis…" : "Vérifier mon explication"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="rounded-2xl bg-warning-soft px-4 py-3">
          {error}
        </p>
      ) : null}
      {result ? (
        <section className="flex animate-card-in flex-col gap-4 rounded-3xl border bg-card p-5" aria-live="polite">
          {result.right.length ? (
            <div className="flex flex-col gap-2">
              <h2 className="font-semibold">Ce qui est juste</h2>
              <ul className="flex flex-col gap-1">
                {result.right.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <CheckCircle2 className="mt-1 size-5 shrink-0 text-success" aria-hidden="true" /> {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.missing.length ? (
            <div className="flex flex-col gap-2">
              <h2 className="font-semibold">Ce qui manque</h2>
              <ul className="flex flex-col gap-1">
                {result.missing.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <CircleDashed className="mt-1 size-5 shrink-0 text-warning" aria-hidden="true" /> {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="reading-block rounded-2xl bg-accent px-4 py-3 text-accent-foreground">{result.feedback}</p>
        </section>
      ) : null}
    </div>
  );
}
