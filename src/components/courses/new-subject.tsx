"use client";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSubjectAction } from "@/lib/courses/actions";

export function NewSubject() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const id = useId();

  if (!open)
    return (
      <Button variant="ghost" className="w-fit" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" /> Nouvelle matière
      </Button>
    );
  return (
    <form
      className="flex flex-col gap-3 rounded-3xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createSubjectAction(name);
          if (res.ok && res.slug) router.push(`/matieres/${res.slug}`);
          else setMessage(res.message ?? "Impossible de créer la matière.");
        });
      }}
    >
      <Label htmlFor={id}>Nom de la matière</Label>
      <Input
        id={id}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={2}
        maxLength={120}
        autoFocus
      />
      {message ? (
        <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3">
          {message}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Créer
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
