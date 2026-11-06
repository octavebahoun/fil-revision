"use client";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAnnounce } from "@/components/providers/announcer";
import { deleteDocumentAction, moveDocumentAction, setDocumentKindAction } from "@/lib/courses/actions";

export function DocumentAdmin({
  documentId,
  kind,
  subjectId,
  subjectSlug,
  subjects,
}: {
  documentId: string;
  kind: "cours" | "exercice" | "ressource";
  subjectId: string;
  subjectSlug: string;
  subjects: { id: string; name: string }[];
}) {
  const [confirm, setConfirm] = useState(false);
  const [target, setTarget] = useState(subjectId);
  const [pending, start] = useTransition();
  const router = useRouter();
  const announce = useAnnounce();
  const id = useId();
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-kind`}>Type de document</Label>
        <select
          id={`${id}-kind`}
          defaultValue={kind}
          className="h-12 rounded-xl border border-input bg-card px-3 text-base text-foreground"
          onChange={(e) => start(() => setDocumentKindAction(documentId, e.target.value as typeof kind))}
        >
          <option value="cours">Cours</option>
          <option value="exercice">Énoncé d&apos;exercice</option>
          <option value="ressource">Ressource</option>
        </select>
      </div>

      {/* Un cours rangé dans la mauvaise matière : il part avec ses notions, ses cartes et ta progression. */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-subject`}>Matière</Label>
        <div className="flex flex-wrap gap-2">
          <select
            id={`${id}-subject`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-base text-foreground"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={pending || target === subjectId}
            onClick={() =>
              start(async () => {
                const res = await moveDocumentAction(documentId, target);
                if (!res.ok) return announce(res.message, "warning");
                announce(`Cours déplacé dans « ${res.subjectName} ».`, "success");
                router.refresh();
              })
            }
          >
            Déplacer
          </Button>
        </div>
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
