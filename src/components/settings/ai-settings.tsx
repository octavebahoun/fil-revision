"use client";
import { useSettings } from "@/components/providers/settings-provider";

const OPTIONS = [
  { value: "meta", label: "Meta (par défaut)", hint: "Raisonne avant de répondre : plus lent, souvent plus nuancé." },
  { value: "deepseek", label: "DeepSeek", hint: "Plus rapide et moins cher pour préparer les cartes." },
] as const;

/** Choix du fournisseur IA principal ; l'autre prend le relais s'il ne répond pas. */
export function AiSettings() {
  const { settings, update } = useSettings();
  return (
    <section className="flex flex-col gap-5 rounded-3xl border bg-card p-5">
      <h2 className="text-lg font-bold">Intelligence artificielle</h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Fournisseur principal</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 border-input bg-card px-4 py-2 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring"
            >
              <input
                type="radio"
                name="aiProvider"
                className="size-5 accent-[var(--primary)]"
                checked={settings.aiProvider === o.value}
                onChange={() => update({ aiProvider: o.value })}
              />
              <span className="flex flex-col">
                <span>{o.label}</span>
                <span className="text-sm text-muted-foreground">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm text-muted-foreground">
        S&apos;il ne répond pas, l&apos;autre prend le relais. Le changement s&apos;applique en moins d&apos;une minute, y compris
        aux cours en préparation.
      </p>
    </section>
  );
}
