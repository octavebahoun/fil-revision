import type { Metadata } from "next";
import { Coins } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { startOfParisDay } from "@/lib/ai/server";
import { formatUsd } from "@/lib/ai/estimate";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { EmptyState } from "@/components/common/empty-state";
import { MoreDetails } from "@/components/common/more-details";

export const metadata: Metadata = { title: "Coûts IA" };

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const PURPOSE: Record<string, string> = {
  segment: "Découpage en notions",
  generate_fiche: "Fiches et flashcards",
  generate_quiz: "Quiz",
  verify: "Vérification",
  regenerate_card: "Correction de carte",
  tutor: "Tuteur",
  feynman: "Méthode Feynman",
  exercise_guide: "Aide aux exercices",
  exercise_feedback: "Retour sur exercice",
  mindmap: "Carte mentale",
  code_exercise: "Exercices de code",
};

export default async function CoutsPage() {
  const { supabase } = await requireUser();
  const budget = env().AI_DAILY_BUDGET_USD;
  const dayStart = startOfParisDay();
  const monthStart = daysAgoIso(30);
  const [{ data: today }, { data: month }, { data: recent }] = await Promise.all([
    supabase.from("ai_calls").select("cost_usd").gte("created_at", dayStart).limit(1000),
    supabase.from("ai_calls").select("cost_usd, purpose").gte("created_at", monthStart).limit(1000),
    supabase
      .from("ai_calls")
      .select("id, provider, model, purpose, prompt_tokens, completion_tokens, cost_usd, ok, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const spentToday = (today ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  const spentMonth = (month ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  const byPurpose = new Map<string, number>();
  for (const r of month ?? []) byPurpose.set(r.purpose, (byPurpose.get(r.purpose) ?? 0) + Number(r.cost_usd));
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  return (
    <>
      <PageHeader title="Coûts IA" subtitle="Chaque génération est payée par tes clés. Voici où va l'argent." />
      <section className="mb-6 flex flex-col gap-3 rounded-3xl border bg-card p-5">
        <p className="text-lg">
          Aujourd&apos;hui : <strong>{formatUsd(spentToday)}</strong> sur {formatUsd(budget)}
        </p>
        <ProgressBar value={Math.min(spentToday, budget)} max={budget} label="Budget IA du jour" />
        <p className="text-muted-foreground">
          {spentToday >= budget
            ? "Plafond atteint : la préparation reprendra demain, toute seule."
            : `Il reste ${formatUsd(budget - spentToday)} pour aujourd'hui. 30 derniers jours : ${formatUsd(spentMonth)}.`}
        </p>
      </section>
      {!recent?.length ? (
        <EmptyState
          icon={Coins}
          title="Aucun appel IA pour l'instant"
          text="Ajoute un cours : le coût de sa préparation apparaîtra ici."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="usage" className="flex flex-col gap-2">
            <h2 id="usage" className="text-lg font-semibold">
              Sur 30 jours, par usage
            </h2>
            <ul className="flex flex-col gap-1">
              {[...byPurpose.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([p, v]) => (
                  <li key={p} className="flex justify-between gap-3 rounded-xl px-2 py-1">
                    <span>{PURPOSE[p] ?? p}</span>
                    <span className="text-muted-foreground">{formatUsd(v)}</span>
                  </li>
                ))}
            </ul>
          </section>
          <MoreDetails label="Journal des derniers appels">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">50 derniers appels IA</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="py-2 pr-3">
                      Quand
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      Usage
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      Fournisseur
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      Tokens
                    </th>
                    <th scope="col" className="py-2">
                      Coût
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmt.format(new Date(r.created_at))}</td>
                      <td className="py-2 pr-3">
                        {PURPOSE[r.purpose] ?? r.purpose}
                        {r.ok ? "" : " (refusé, relancé)"}
                      </td>
                      <td className="py-2 pr-3">{r.provider}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {r.prompt_tokens} → {r.completion_tokens}
                      </td>
                      <td className="py-2 whitespace-nowrap">{formatUsd(Number(r.cost_usd))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MoreDetails>
        </div>
      )}
    </>
  );
}
