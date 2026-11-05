"use client";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addExamAction } from "@/lib/exams-actions";

export function AddExam({ subjects, today }: { subjects: { id: string; name: string }[]; today: string }) {
  const [state, action, pending] = useActionState(addExamAction, null);
  const id = useId();
  return (
    <form action={action} className="flex flex-col gap-4 rounded-3xl border bg-card p-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-s`}>Matière</Label>
        <select
          id={`${id}-s`}
          name="subjectId"
          required
          className="h-12 rounded-xl border border-input bg-card px-3 text-base text-foreground"
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-t`}>Nom (facultatif)</Label>
          <Input id={`${id}-t`} name="title" placeholder="Partiel, contrôle…" maxLength={120} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-d`}>Date</Label>
          <Input id={`${id}-d`} name="date" type="date" min={today} required />
        </div>
      </div>
      {state?.message ? (
        <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        Ajouter
      </Button>
    </form>
  );
}
