import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Flame, Play, BookOpen, Moon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { loadHome } from "@/lib/data/home";
import { startSessionAction } from "@/lib/review/actions";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/common/progress-bar";
import { EmptyState } from "@/components/common/empty-state";
import { DurationPicker, StartForm } from "@/components/home/duration-picker";
import { SubmitButton } from "@/components/common/submit-button";

export const metadata: Metadata = { title: "Accueil" };

function greeting() {
  const h = Number(
    new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Paris" }).format(
      new Date(),
    ),
  );
  return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
}

export default async function AccueilPage() {
  const { user, supabase } = await requireUser();
  const home = await loadHome(supabase, user.id);

  if (!home.hasContent) {
    return (
      <section className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold">{greeting()} !</h1>
        <EmptyState
          icon={BookOpen}
          title="Ajoute ton premier cours"
          text="Dépose un PDF, un PowerPoint ou un Word. Fil prépare tes fiches et tes cartes."
          action={
            <Button asChild size="lg">
              <Link href="/matieres">Choisir une matière</Link>
            </Button>
          }
        />
      </section>
    );
  }

  const today = [
    home.due ? `${home.due} carte${home.due > 1 ? "s" : ""} à revoir` : "",
    home.fresh ? `${home.fresh} nouvelle${home.fresh > 1 ? "s" : ""} notion${home.fresh > 1 ? "s" : ""}` : "",
  ].filter(Boolean);

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold">{greeting()} !</h1>

      <div className="flex flex-col items-center gap-4 rounded-3xl border bg-card px-5 py-7 shadow-sm">
        {home.activeSession ? (
          <>
            <Button asChild size="xl" className="w-full">
              <Link href={`/session/${home.activeSession.id}`}>
                <Play className="size-6" aria-hidden="true" />
                Reprendre ma session ({home.activeSession.position + 1}/{home.activeSession.total})
              </Link>
            </Button>
            <p className="text-muted-foreground">Tu étais en pleine session. Ta place est gardée.</p>
          </>
        ) : (
          <>
            <StartForm action={startSessionAction} />
            <DurationPicker />
            <p className="text-center text-muted-foreground">
              {today.length
                ? `Aujourd'hui : ${today.join(" · ")}.`
                : "Tout est à jour. Une petite session garde le fil."}
            </p>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {home.streak.current > 0 ? (
          <p className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-accent-foreground">
            <Flame className="size-5" aria-hidden="true" />
            Série : {home.streak.current} jour{home.streak.current > 1 ? "s" : ""}
            {home.streak.jokers ? ` · ${home.streak.jokers} joker${home.streak.jokers > 1 ? "s" : ""}` : ""}
          </p>
        ) : null}
        {!home.activeSession ? (
          <form action={startSessionAction}>
            <input type="hidden" name="mode" value="fatigue" />
            <input type="hidden" name="minutes" value="5" />
            <SubmitButton variant="ghost" pendingLabel="Je prépare…">
              <Moon aria-hidden="true" /> Fatigué ? Session douce
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {home.mastery.length ? (
        <section aria-labelledby="maitrise" className="flex flex-col gap-3">
          <h2 id="maitrise" className="text-lg font-semibold">
            Maîtrise par matière
          </h2>
          <ul className="flex flex-col gap-3">
            {home.mastery.map((m) => (
              <li key={m.id}>
                <Link href={`/matieres/${m.slug}`} className="flex flex-col gap-2 rounded-2xl px-1 py-1 hover:bg-muted">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="leading-snug">{m.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">{m.percent} %</span>
                  </span>
                  <ProgressBar value={m.percent} max={100} label={`Maîtrise de ${m.name}`} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {home.nextExam ? (
        <Link
          href="/examens"
          className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary/50"
        >
          <CalendarDays className="size-6 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <span className="font-semibold">Prochain examen : </span>
            {home.nextExam.title} ({home.nextExam.subject}),{" "}
            {home.nextExam.inDays === 0
              ? "aujourd'hui"
              : home.nextExam.inDays === 1
                ? "demain"
                : `dans ${home.nextExam.inDays} jours`}
          </span>
        </Link>
      ) : null}
    </section>
  );
}
