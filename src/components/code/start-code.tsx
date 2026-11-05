"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Code2 } from "lucide-react";
import { createCodeExerciseAction } from "@/lib/code/actions";

/** Lien « Exercice de code » : créé à la demande (aucun coût tant qu'on ne le demande pas). */
export function StartCode({ notionId }: { notionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await createCodeExerciseAction(notionId);
            if (res.ok) router.push(`/code/${res.cardId}`);
            else setError(res.message);
          })
        }
        className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-left hover:bg-muted"
      >
        <Code2 className="size-5 text-primary" aria-hidden="true" />{" "}
        {pending ? "Je prépare l'exercice…" : "Exercice de code"}
      </button>
      {error ? (
        <p role="alert" className="px-3 text-muted-foreground">
          {error}
        </p>
      ) : null}
    </>
  );
}
