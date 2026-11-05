"use client";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Flag, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAnnounce } from "@/components/providers/announcer";
import { CardSummary, typeLabel } from "@/components/cards/card-summary";
import { deleteCardAction, flagCardAction, updateCardAction } from "@/lib/cards/actions";

type Card = { id: string; type: string; content: Record<string, unknown>; status: string; edited: boolean };

const FIELD_LABEL: Record<string, string> = {
  title: "Titre",
  explanation: "Explication",
  example: "Exemple",
  question: "Question",
  answer: "Réponse",
  more: "En savoir plus",
  front: "Recto (question)",
  back: "Verso (réponse)",
  statement: "Affirmation",
  choices: "Choix (un par ligne)",
  answerIndex: "Numéro de la bonne réponse (0 = premier)",
  answers: "Réponses acceptées (une par ligne)",
  items: "Éléments dans le bon ordre (un par ligne)",
  blanks: "Réponses des trous (une par ligne)",
  code: "Code (____ pour chaque trou)",
  language: "Langage",
  en: "Anglais",
  fr: "Français",
  context: "Contexte",
};

/** Éditeur générique : chaque champ texte devient une zone de saisie étiquetée. */
function CardEditor({ card, onDone }: { card: Card; onDone: () => void }) {
  const [draft, setDraft] = useState<Record<string, unknown>>(card.content);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const baseId = useId();
  const announce = useAnnounce();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateCardAction(card.id, draft);
          if (!res.ok) return setMessage(res.message);
          announce("Carte enregistrée.", "success");
          router.refresh();
          onDone();
        });
      }}
    >
      {Object.entries(draft).map(([key, value]) => {
        const id = `${baseId}-${key}`;
        if (key === "pairs" && Array.isArray(value)) {
          return (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={id}>Paires (une par ligne : gauche = droite)</Label>
              <Textarea
                id={id}
                value={(value as { left: string; right: string }[]).map((p) => `${p.left} = ${p.right}`).join("\n")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    pairs: e.target.value
                      .split("\n")
                      .filter((l) => l.includes("="))
                      .map((l) => ({ left: l.split("=")[0]!.trim(), right: l.split("=").slice(1).join("=").trim() })),
                  })
                }
              />
            </div>
          );
        }
        if (typeof value === "boolean") {
          return (
            <label key={key} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5"
                checked={value}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
              />
              {key === "answer" ? "L'affirmation est vraie" : key}
            </label>
          );
        }
        if (typeof value === "number") {
          return (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={id}>{FIELD_LABEL[key] ?? key}</Label>
              <input
                id={id}
                type="number"
                min={0}
                className="h-12 rounded-xl border border-input bg-card px-3"
                value={value}
                onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
              />
            </div>
          );
        }
        if (Array.isArray(value) || typeof value === "string") {
          const isList = Array.isArray(value);
          return (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={id}>{FIELD_LABEL[key] ?? key}</Label>
              <Textarea
                id={id}
                className={key === "code" ? "font-mono" : ""}
                value={isList ? (value as string[]).join("\n") : (value as string)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [key]: isList ? e.target.value.split("\n").filter((l) => l.trim()) : e.target.value,
                  })
                }
              />
            </div>
          );
        }
        return null;
      })}
      {message ? (
        <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3">
          {message}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Enregistrer
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

function FlagForm({ card, onDone }: { card: Card; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const id = useId();
  const announce = useAnnounce();
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await flagCardAction(card.id, reason);
          announce("Merci. Cette carte sort des révisions et va être corrigée.", "success");
          router.refresh();
          onDone();
        });
      }}
    >
      <Label htmlFor={id}>Qu&apos;est-ce qui ne va pas ? (facultatif)</Label>
      <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Signaler
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/** « Mes contenus » : modifier, supprimer ou signaler une carte comme fausse. */
export function CardManager({ cards }: { cards: Card[] }) {
  const [editing, setEditing] = useState<{ card: Card; mode: "edit" | "flag" } | null>(null);
  const [pending, start] = useTransition();
  const announce = useAnnounce();
  const router = useRouter();

  return (
    <>
      <ul className="flex flex-col gap-3">
        {cards.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {typeLabel(c.type)}
                {c.edited ? " · modifiée" : ""}
                {c.status === "flagged" ? " · signalée, en cours de correction" : ""}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Modifier"
                  onClick={() => setEditing({ card: c, mode: "edit" })}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Signaler comme fausse"
                  onClick={() => setEditing({ card: c, mode: "flag" })}
                >
                  <Flag aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await deleteCardAction(c.id);
                      announce("Carte supprimée.");
                      router.refresh();
                    })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </div>
            <CardSummary type={c.type} content={c.content} />
          </li>
        ))}
      </ul>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.mode === "flag" ? "Signaler une erreur" : "Modifier la carte"}</DialogTitle>
            <DialogDescription>
              {editing?.mode === "flag"
                ? "La carte sort tout de suite des révisions. Fil la corrige à partir du cours, ou la retire."
                : "Tes changements sont gardés, même si le cours est régénéré."}
            </DialogDescription>
          </DialogHeader>
          {editing?.mode === "edit" ? <CardEditor card={editing.card} onDone={() => setEditing(null)} /> : null}
          {editing?.mode === "flag" ? <FlagForm card={editing.card} onDone={() => setEditing(null)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
