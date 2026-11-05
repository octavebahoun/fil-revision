import type { CardType } from "@/lib/content/schemas";

const TYPE_LABEL: Record<string, string> = {
  fiche: "Fiche",
  flashcard: "Flashcard",
  qcm: "QCM",
  vrai_faux: "Vrai ou faux",
  reponse_courte: "Réponse courte",
  code_trou: "Code à compléter",
  ordre: "Remettre dans l'ordre",
  association: "Associer",
  vocab: "Vocabulaire",
  phrase: "Phrase utile",
  code_exercise: "Exercice de code",
};

export function typeLabel(type: string) {
  return TYPE_LABEL[type] ?? type;
}

type Any = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");

/** Résumé compact d'une carte (liste « Mes contenus »). */
export function CardSummary({ type, content }: { type: CardType | string; content: Any }) {
  switch (type) {
    case "flashcard":
      return (
        <>
          <p className="font-semibold">{s(content.front)}</p>
          <p className="text-muted-foreground">{s(content.back)}</p>
        </>
      );
    case "qcm": {
      const choices = (content.choices as string[]) ?? [];
      return (
        <>
          <p className="font-semibold">{s(content.question)}</p>
          <p className="text-muted-foreground">Bonne réponse : {choices[Number(content.answerIndex)] ?? "?"}</p>
        </>
      );
    }
    case "vrai_faux":
      return (
        <>
          <p className="font-semibold">{s(content.statement)}</p>
          <p className="text-muted-foreground">{content.answer ? "Vrai" : "Faux"}</p>
        </>
      );
    case "reponse_courte":
      return (
        <>
          <p className="font-semibold">{s(content.question)}</p>
          <p className="text-muted-foreground">{((content.answers as string[]) ?? []).join(" / ")}</p>
        </>
      );
    case "ordre":
      return (
        <>
          <p className="font-semibold">{s(content.question)}</p>
          <p className="text-muted-foreground">{((content.items as string[]) ?? []).join(" → ")}</p>
        </>
      );
    case "association":
      return (
        <>
          <p className="font-semibold">{s(content.question)}</p>
          <p className="text-muted-foreground">
            {((content.pairs as { left: string; right: string }[]) ?? [])
              .map((p) => `${p.left} ↔ ${p.right}`)
              .join(" · ")}
          </p>
        </>
      );
    case "code_trou":
      return (
        <>
          <p className="font-semibold">{s(content.question)}</p>
          <pre className="overflow-x-auto rounded-xl bg-muted p-3 font-mono text-sm">{s(content.code)}</pre>
        </>
      );
    case "vocab":
    case "phrase":
      return (
        <>
          <p className="font-semibold" lang="en">
            {s(content.en)}
          </p>
          <p className="text-muted-foreground">{s(content.fr)}</p>
        </>
      );
    default:
      return <p className="font-semibold">{s(content.title) || s(content.question) || typeLabel(type)}</p>;
  }
}
