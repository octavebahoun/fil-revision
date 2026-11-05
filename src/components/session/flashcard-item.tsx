"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SpeakButton } from "@/components/cards/speak-button";

type C = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export const RATINGS = [
  { value: 1, label: "À revoir", key: "1" },
  { value: 2, label: "Difficile", key: "2" },
  { value: 3, label: "Bien", key: "3" },
  { value: 4, label: "Facile", key: "4" },
] as const;

/** Flashcard : Espace retourne (3D doux, 400 ms), 1 à 4 notent, « J'étais absent » ne pénalise pas. */
export function FlashcardItem({
  type,
  content,
  onRate,
  onAbsent,
}: {
  type: string;
  content: C;
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  onAbsent: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const english = type === "vocab" || type === "phrase";
  const front = english ? str(content.en) : str(content.front);
  const back = english ? str(content.fr) : str(content.back);
  const extra = type === "vocab" ? str(content.example) : type === "phrase" ? str(content.context) : "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        onRate(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, onRate]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flip-scene">
        <div className="flip-card min-h-56" data-flipped={flipped}>
          <button
            type="button"
            onClick={() => setFlipped(true)}
            aria-hidden={flipped}
            tabIndex={flipped ? -1 : 0}
            className="flip-face flip-front flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 bg-card p-6 text-center"
          >
            <span className="text-sm font-medium text-muted-foreground">{english ? "En français ?" : "Question"}</span>
            <span className="text-2xl leading-snug font-semibold text-balance" lang={english ? "en" : undefined}>
              {front}
            </span>
          </button>
          <div
            aria-hidden={!flipped}
            className="flip-face flip-back flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-primary/40 bg-secondary p-6 text-center text-secondary-foreground"
          >
            <span className="text-sm font-medium">Réponse</span>
            <span className="text-xl leading-snug font-semibold text-balance">{back}</span>
            {extra ? (
              <span className="text-base" lang={type === "vocab" ? "en" : undefined}>
                {extra}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2">
        <SpeakButton text={flipped ? back : front} lang={english && !flipped ? "en-GB" : "fr-FR"} />
        <span aria-live="polite" className="sr-only">
          {flipped ? `Réponse : ${back}` : ""}
        </span>
      </div>
      {flipped ? (
        <div className="flex flex-col gap-3">
          <p className="text-center text-base text-muted-foreground">Comment ça s&apos;est passé ?</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RATINGS.map((r) => (
              <Button
                key={r.value}
                variant={r.value === 3 ? "default" : "outline"}
                size="lg"
                onClick={() => onRate(r.value)}
                aria-keyshortcuts={r.key}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <Button size="lg" onClick={() => setFlipped(true)} aria-keyshortcuts="Space">
          Voir la réponse
        </Button>
      )}
      <Button variant="ghost" onClick={onAbsent} className="self-center text-muted-foreground">
        J&apos;étais absent — elle reviendra plus tard
      </Button>
    </div>
  );
}
