"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { finishMockExamAction } from "@/lib/review/actions";
import type { ExamResult } from "@/lib/review/exam";

/**
 * Minuteur d'examen blanc (optionnel) : il se met en pause tout seul quand tu es inactif
 * ou quand l'onglet est caché. Pas de chiffres qui défilent : seulement les minutes, calmement.
 */
export function ExamTimer({ sessionId, minutes, paused }: { sessionId: string; minutes: number; paused: boolean }) {
  const key = `fil:timer:${sessionId}`;
  const [left, setLeft] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      return Number.isFinite(saved) && saved > 0 ? saved : minutes * 60_000;
    } catch {
      return minutes * 60_000;
    }
  });
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    const t = setInterval(() => {
      if (pausedRef.current || document.visibilityState === "hidden") return;
      setLeft((l) => {
        const next = Math.max(0, l - 1000);
        try {
          localStorage.setItem(key, String(next));
        } catch {
          /* sans conséquence */
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [key]);
  const mins = Math.ceil(left / 60_000);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
      role="timer"
      aria-live="off"
    >
      <Hourglass className="size-4" aria-hidden="true" />
      {left === 0 ? "Temps écoulé, finis tranquillement" : paused ? `${mins} min (en pause)` : `${mins} min`}
    </span>
  );
}

/** Bilan d'examen blanc : score, notions faibles (remises dans tes révisions). */
export function ExamDone({ sessionId }: { sessionId: string }) {
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const run = async (attempt: number) => {
      try {
        // Laisse le temps à la file d'envoi de transmettre les dernières réponses.
        await new Promise((r) => setTimeout(r, 1200));
        const res = await finishMockExamAction(sessionId);
        if (!cancelled) setResult(res);
      } catch {
        if (attempt < 3) void run(attempt + 1);
        else if (!cancelled) setError(true);
      }
    };
    void run(0);
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (error) return <p className="rounded-2xl bg-warning-soft px-4 py-3">Le bilan sera prêt au retour du réseau.</p>;
  if (!result)
    return <p className="animate-calm-pulse rounded-2xl bg-muted px-4 py-6 text-center">Je prépare ton bilan…</p>;
  const pct = result.answered ? Math.round((result.correct / result.answered) * 100) : 0;
  return (
    <section className="flex flex-col gap-5 rounded-3xl border bg-card p-6" aria-labelledby="bilan">
      <h1 id="bilan" className="text-2xl font-bold">
        Bilan de l&apos;examen blanc
      </h1>
      <p className="text-lg">
        {result.correct} bonne{result.correct > 1 ? "s" : ""} réponse{result.correct > 1 ? "s" : ""} sur{" "}
        {result.answered} ({pct} %).
      </p>
      {result.weak.length ? (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">À retravailler (ajouté à tes révisions)</h2>
          <ul className="flex flex-col gap-1">
            {result.weak.map((w) => (
              <li key={w.notionId}>
                <Link
                  href={`/notions/${w.notionId}`}
                  className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
                >
                  {w.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-2xl bg-success-soft px-4 py-3">Aucune notion faible repérée. Bravo !</p>
      )}
      <Button asChild size="lg">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </section>
  );
}
