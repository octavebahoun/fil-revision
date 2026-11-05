import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { parseSettings } from "@/lib/settings";
import { startMockExamAction } from "@/lib/review/actions";
import { PageHeader } from "@/components/common/page-header";
import { SubmitButton } from "@/components/common/submit-button";

export const metadata: Metadata = { title: "Examen blanc" };

export default async function ExamenBlancPage({ searchParams }: PageProps<"/examens/blanc">) {
  const sp = await searchParams;
  const slug = typeof sp.matiere === "string" ? sp.matiere : "";
  const { user, supabase } = await requireUser();
  const [{ data: subject }, { data: profile }] = await Promise.all([
    supabase.from("subjects").select("id, name").eq("slug", slug).maybeSingle(),
    supabase.from("profiles").select("settings").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!subject) notFound();
  const timerDefault = parseSettings(profile?.settings).examTimerDefault;
  return (
    <>
      <PageHeader
        title={`Examen blanc : ${subject.name}`}
        back={{ href: `/matieres/${slug}`, label: "La matière" }}
        subtitle="Un quiz mixte sur toute la matière. Le bilan montre ce qu'il faut retravailler."
      />
      {sp.vide ? (
        <p role="status" className="mb-6 rounded-2xl bg-info-soft px-4 py-3">
          Pas encore assez de questions dans cette matière. Reviens quand ses cours seront prêts.
        </p>
      ) : null}
      <form action={startMockExamAction} className="flex flex-col gap-6">
        <input type="hidden" name="matiere" value={slug} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">Nombre de questions</legend>
          <div className="flex gap-2">
            {[10, 20, 30].map((n, i) => (
              <label
                key={n}
                className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-input bg-card has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring"
              >
                <input type="radio" name="count" value={n} defaultChecked={i === 0} className="sr-only" />
                {n}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">Minuteur</legend>
          <p className="text-sm text-muted-foreground">
            Facultatif. Il se met en pause tout seul si tu décroches ou changes d&apos;onglet.
          </p>
          <select
            name="timer"
            defaultValue={timerDefault ? "20" : "0"}
            className="h-12 rounded-xl border border-input bg-card px-3 text-base text-foreground"
            aria-label="Minuteur"
          >
            <option value="0">Sans minuteur</option>
            <option value="10">10 minutes</option>
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 heure</option>
          </select>
        </fieldset>
        <SubmitButton size="xl" pendingLabel="Je prépare l'examen…">
          Commencer l&apos;examen blanc
        </SubmitButton>
      </form>
    </>
  );
}
