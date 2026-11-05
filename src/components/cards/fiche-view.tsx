import type { FicheContent } from "@/lib/content/schemas";
import { MoreDetails } from "@/components/common/more-details";
import { SpeakButton } from "@/components/cards/speak-button";

/**
 * Une fiche = une explication + un exemple + UNE question.
 * Chaque bloc tient en 5 lignes sur mobile ; le reste est derrière « En savoir plus ».
 */
export function FicheView({ fiche, footer }: { fiche: FicheContent; footer?: React.ReactNode }) {
  const speech = `${fiche.title}. ${fiche.explanation} Exemple : ${fiche.example} Question : ${fiche.question}`;
  return (
    <article
      className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm md:p-7"
      aria-label={`Fiche : ${fiche.title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl leading-snug font-bold md:text-2xl">{fiche.title}</h2>
        <SpeakButton text={speech} />
      </div>
      <p className="reading-block">{fiche.explanation}</p>
      <div className="reading-block rounded-2xl bg-accent px-4 py-3 text-accent-foreground">
        <span className="font-semibold">Exemple : </span>
        {fiche.example}
      </div>
      <p className="reading-block rounded-2xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground">
        {fiche.question}
      </p>
      <MoreDetails label="Voir la réponse et plus">
        <p className="mb-2">
          <span className="font-semibold text-foreground">Réponse : </span>
          {fiche.answer}
        </p>
        {fiche.more ? <p>{fiche.more}</p> : null}
      </MoreDetails>
      {footer}
    </article>
  );
}
