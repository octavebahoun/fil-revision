"use client";
import { useId, useState, useTransition } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProgressBar } from "@/components/common/progress-bar";
import type { FeedbackOutput, GuideOutput } from "@/lib/ai/tasks/exercise";
import { revealHintAction, stepFeedbackAction } from "@/lib/exercises/actions";

type Progress = Record<number, { hints: number; answer: string; feedback: FeedbackOutput | null }>;

/** Aide guidée : une étape à la fois, indices progressifs, commentaire bienveillant de ta réponse. */
export function GuidedExercise({
  guideId,
  guide,
  initial,
}: {
  guideId: string;
  guide: GuideOutput;
  initial: Progress;
}) {
  const [index, setIndex] = useState(() => {
    const firstOpen = guide.steps.findIndex((_, i) => initial[i]?.feedback?.status !== "ok");
    return firstOpen === -1 ? 0 : firstOpen;
  });
  const [progress, setProgress] = useState<Progress>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const answerId = useId();
  const step = guide.steps[index]!;
  const p = progress[index] ?? { hints: 0, answer: "", feedback: null };
  const set = (patch: Partial<Progress[number]>) => setProgress((prev) => ({ ...prev, [index]: { ...p, ...patch } }));

  return (
    <div className="flex flex-col gap-5">
      {index === 0 ? <p className="reading-block text-muted-foreground">{guide.intro}</p> : null}
      <div className="flex flex-col gap-2">
        <span className="font-semibold" aria-live="polite">
          Étape {index + 1} sur {guide.steps.length}
        </span>
        <ProgressBar
          value={index + (p.feedback?.status === "ok" ? 1 : 0)}
          max={guide.steps.length}
          label="Progression de l'exercice"
        />
      </div>
      <section key={index} className="flex animate-card-in flex-col gap-4 rounded-3xl border bg-card p-5">
        <h2 className="text-xl font-bold">{step.title}</h2>
        <p className="reading-block">{step.goal}</p>
        {step.hints.slice(0, p.hints).map((h, i) => (
          <p key={i} className="reading-block flex gap-2 rounded-2xl bg-accent px-4 py-3 text-accent-foreground">
            <Lightbulb className="mt-1 size-5 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">Indice {i + 1} : </span>
              {h}
            </span>
          </p>
        ))}
        {p.hints < step.hints.length ? (
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => start(async () => set({ hints: await revealHintAction(guideId, index) }))}
          >
            <Lightbulb aria-hidden="true" /> {p.hints === 0 ? "Un indice" : `Indice ${p.hints + 1}`}
          </Button>
        ) : null}
        <div className="flex flex-col gap-2">
          <label htmlFor={answerId} className="font-semibold">
            Ma réponse
          </label>
          <Textarea
            id={answerId}
            rows={5}
            value={p.answer}
            onChange={(e) => set({ answer: e.target.value })}
            maxLength={4000}
          />
        </div>
        <Button
          size="lg"
          disabled={pending || p.answer.trim().length < 5}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await stepFeedbackAction(guideId, index, p.answer);
              if (res.ok) set({ feedback: res.result });
              else setError(res.message);
            })
          }
        >
          {pending ? "Je lis ta réponse…" : "Commenter ma réponse"}
        </Button>
        {error ? (
          <p role="alert" className="rounded-2xl bg-warning-soft px-4 py-3">
            {error}
          </p>
        ) : null}
        {p.feedback ? (
          <p
            aria-live="polite"
            className={`reading-block rounded-2xl px-4 py-3 ${p.feedback.status === "ok" ? "bg-success-soft" : p.feedback.status === "partial" ? "bg-info-soft" : "bg-warning-soft"}`}
          >
            {p.feedback.feedback}
          </p>
        ) : null}
      </section>
      <div className="flex justify-between gap-3">
        <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Étape précédente
        </Button>
        {index < guide.steps.length - 1 ? (
          <Button onClick={() => setIndex(index + 1)}>Étape suivante</Button>
        ) : (
          <span className="content-center text-muted-foreground">Dernière étape</span>
        )}
      </div>
    </div>
  );
}
