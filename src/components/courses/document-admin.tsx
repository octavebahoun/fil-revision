"use client";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { deleteDocumentAction, setDocumentKindAction } from "@/lib/courses/actions";

export function DocumentAdmin({
  documentId,
  kind,
  subjectSlug,
}: {
  documentId: string;
  kind: "cours" | "exercice" | "ressource";
  subjectSlug: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const id = useId();
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>Type de document</Label>
        <select
          id={id}
          defaultValue={kind}
          className="h-12 rounded-xl border border-input bg-card px-3 text-base text-foreground"
          onChange={(e) => start(() => setDocumentKindAction(documentId, e.target.value as typeof kind))}
        >
          <option value="cours">Cours</option>
          <option value="exercice">Énoncé d&apos;exercice</option>
          <option value="ressource">Ressource</option>
        </select>
      </div>
      {confirm ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-warning-soft p-4 text-foreground">
          <p>Supprimer ce cours, ses notions et ses cartes ? Ta progression dessus sera effacée.</p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await deleteDocumentAction(documentId);
                  router.push(`/matieres/${subjectSlug}`);
                })
              }
            >
              Oui, supprimer
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Garder
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="destructive" className="w-fit" onClick={() => setConfirm(true)}>
          Supprimer ce cours
        </Button>
      )}
    </div>
  );
}
