import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { startSessionAction } from "@/lib/review/actions";
import { parseSettings } from "@/lib/settings";
import { PageHeader } from "@/components/common/page-header";
import { SubmitButton } from "@/components/common/submit-button";

export const metadata: Metadata = { title: "Réviser" };

const MODES = [
  { value: "mix", label: "Mélange", hint: "Cartes dues + nouvelles notions (recommandé)" },
  { value: "fiches", label: "Lire les fiches", hint: "Une fiche par écran, flèches ou glissement" },
  { value: "flashcards", label: "Flashcards", hint: "Retourner, puis noter de 1 à 4" },
  { value: "quiz", label: "Quiz", hint: "QCM, vrai/faux, réponses courtes…" },
];

export default async function ReviserPage({ searchParams }: PageProps<"/reviser">) {
  const sp = await searchParams;
  const { user, supabase } = await requireUser();
  const matiere = typeof sp.matiere === "string" ? sp.matiere : undefined;
  const notion = typeof sp.notion === "string" ? sp.notion : undefined;
  const [{ data: subject }, { data: profile }] = await Promise.all([
    matiere
      ? supabase.from("subjects").select("name").eq("slug", matiere).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("settings").eq("user_id", user.id).maybeSingle(),
  ]);
  const minutes = parseSettings(profile?.settings).sessionMinutes;

  return (
    <>
      <PageHeader
        title={subject ? `Réviser : ${subject.name}` : "Réviser"}
        back={matiere ? { href: `/matieres/${matiere}`, label: "La matière" } : { href: "/", label: "Accueil" }}
        subtitle={`${minutes} minutes, sans chrono.`}
      />
      {sp.vide ? (
        <p role="status" className="mb-6 rounded-2xl bg-success-soft px-4 py-3">
          Rien à réviser ici pour l&apos;instant : tout est à jour. Bravo !
        </p>
      ) : null}
      <form action={startSessionAction} className="flex flex-col gap-6">
        {matiere ? <input type="hidden" name="matiere" value={matiere} /> : null}
        {notion ? <input type="hidden" name="notion" value={notion} /> : null}
        <input type="hidden" name="minutes" value={minutes} />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-lg font-semibold">Comment veux-tu réviser ?</legend>
          {MODES.map((m, i) => (
            <label
              key={m.value}
              className="flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border-2 border-input bg-card px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring"
            >
              <input
                type="radio"
                name="mode"
                value={m.value}
                defaultChecked={i === 0}
                className="size-5 accent-[var(--primary)]"
              />
              <span className="flex flex-col">
                <span className="font-semibold">{m.label}</span>
                <span className="text-sm text-muted-foreground">{m.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <SubmitButton size="xl" pendingLabel="Je prépare ta session…">
          Commencer
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-muted-foreground">
        La durée se règle depuis l&apos;
        <Link href="/" className="text-primary underline">
          accueil
        </Link>
        .
      </p>
    </>
  );
}
