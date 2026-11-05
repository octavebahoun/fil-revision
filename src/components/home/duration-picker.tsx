"use client";
import { Play } from "lucide-react";
import { useSettings } from "@/components/providers/settings-provider";
import { SubmitButton } from "@/components/common/submit-button";

const OPTIONS = [5, 10, 15, 25] as const;

/** Choix discret de la durée (mémorisé). */
export function DurationPicker() {
  const { settings, update } = useSettings();
  return (
    <fieldset className="flex flex-wrap items-center justify-center gap-2">
      <legend className="sr-only">Durée de la session</legend>
      <span className="text-base text-muted-foreground" aria-hidden="true">
        Durée :
      </span>
      {OPTIONS.map((m) => (
        <label
          key={m}
          className={`inline-flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-full border px-3 text-base has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring ${
            settings.sessionMinutes === m
              ? "border-primary bg-secondary font-semibold text-secondary-foreground"
              : "border-input"
          }`}
        >
          <input
            type="radio"
            name="duree"
            value={m}
            checked={settings.sessionMinutes === m}
            onChange={() => update({ sessionMinutes: m })}
            className="sr-only"
          />
          {m} min
        </label>
      ))}
    </fieldset>
  );
}

/** Le gros bouton « Réviser maintenant » : la session choisit pour toi (cartes dues + nouveautés). */
export function StartForm({ action }: { action: (fd: FormData) => Promise<void> }) {
  const { settings } = useSettings();
  return (
    <form action={action} className="w-full">
      <input type="hidden" name="minutes" value={settings.sessionMinutes} />
      <input type="hidden" name="mode" value="mix" />
      <SubmitButton size="xl" className="w-full" pendingLabel="Je prépare ta session…">
        <Play className="size-6" aria-hidden="true" />
        Réviser maintenant ({settings.sessionMinutes} min)
      </SubmitButton>
    </form>
  );
}
