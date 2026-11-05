"use client";
import { useId, type ReactNode } from "react";
import { useSettings } from "@/components/providers/settings-provider";
import { SpeakButton } from "@/components/cards/speak-button";
import type { Settings } from "@/lib/settings";

function Choice<K extends keyof Settings>({
  name,
  legend,
  options,
}: {
  name: K;
  legend: string;
  options: { value: Settings[K]; label: string; hint?: string }[];
}) {
  const { settings, update } = useSettings();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={String(o.value)}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 border-input bg-card px-4 py-2 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring"
          >
            <input
              type="radio"
              name={String(name)}
              className="size-5 accent-[var(--primary)]"
              checked={settings[name] === o.value}
              onChange={() => update({ [name]: o.value } as Partial<Settings>)}
            />
            <span className="flex flex-col">
              <span>{o.label}</span>
              {o.hint ? <span className="text-sm text-muted-foreground">{o.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Range({
  label,
  min,
  max,
  step,
  value,
  onChange,
  display,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  display: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex justify-between font-semibold">
        {label} <span className="font-normal text-muted-foreground">{display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full accent-[var(--primary)]"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl border bg-card p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function ComfortSettings() {
  const { settings, update } = useSettings();
  return (
    <div className="flex flex-col gap-6">
      <Section title="Affichage">
        <Choice
          name="theme"
          legend="Thème"
          options={[
            { value: "system", label: "Comme mon appareil" },
            { value: "light", label: "Clair" },
            { value: "dark", label: "Sombre" },
            { value: "contrast", label: "Contraste élevé" },
          ]}
        />
        <Choice
          name="font"
          legend="Police"
          options={[
            { value: "atkinson", label: "Atkinson Hyperlegible", hint: "Lettres faciles à distinguer" },
            { value: "dyslexic", label: "OpenDyslexic", hint: "Pensée pour la dyslexie" },
          ]}
        />
        <Range
          label="Taille du texte"
          min={0.9}
          max={1.6}
          step={0.05}
          value={settings.fontScale}
          onChange={(v) => update({ fontScale: v })}
          display={`${Math.round(settings.fontScale * 100)} %`}
        />
        <Range
          label="Interligne"
          min={1.4}
          max={2.2}
          step={0.05}
          value={settings.lineHeight}
          onChange={(v) => update({ lineHeight: v })}
          display={settings.lineHeight.toFixed(2)}
        />
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="font-semibold">Règle de lecture</span>
            <span className="text-sm text-muted-foreground">Une bande douce surligne la ligne que tu pointes.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="size-6 accent-[var(--primary)]"
            checked={settings.readingRuler}
            onChange={(e) => update({ readingRuler: e.target.checked })}
          />
        </label>
        <p className="reading-block rounded-2xl bg-muted px-4 py-3">
          Aperçu : une notion, une explication, un exemple. Puis une seule question.
        </p>
      </Section>

      <Section title="Mouvement">
        <Choice
          name="motion"
          legend="Animations"
          options={[
            { value: "normal", label: "Normales", hint: "Lentes et douces, jamais de flash" },
            { value: "reduced", label: "Réduites", hint: "Fondus seulement" },
            { value: "none", label: "Aucune" },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Si ton appareil demande moins d&apos;animations, Fil passe automatiquement en « réduites ».
        </p>
      </Section>

      <Section title="Lecture audio">
        <Range
          label="Vitesse de la voix"
          min={0.6}
          max={1.6}
          step={0.1}
          value={settings.ttsRate}
          onChange={(v) => update({ ttsRate: v })}
          display={`× ${settings.ttsRate.toFixed(1)}`}
        />
        <div className="flex items-center gap-2">
          <SpeakButton text="Bonjour. Voici la vitesse de lecture choisie." label="Tester la voix" />
          <span className="text-muted-foreground">Tester la voix</span>
        </div>
      </Section>
    </div>
  );
}
