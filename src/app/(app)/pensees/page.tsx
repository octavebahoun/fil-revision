import type { Metadata } from "next";
import { NotebookPen, Check, Trash2, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { deleteParkingAction, setParkingDoneAction } from "@/lib/parking-actions";

export const metadata: Metadata = { title: "Pensées notées" };

export default async function PenseesPage() {
  const { supabase } = await requireUser();
  const { data: notes } = await supabase
    .from("parking")
    .select("id, text, done, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const open = (notes ?? []).filter((n) => !n.done);
  const done = (notes ?? []).filter((n) => n.done);
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  return (
    <>
      <PageHeader title="Pensées notées" subtitle="Les idées que tu as mises de côté pendant tes sessions." />
      {!notes?.length ? (
        <EmptyState
          icon={NotebookPen}
          title="Rien de noté pour l'instant"
          text="En session, appuie sur « Noter une idée » (ou N) pour garder une pensée sans perdre le fil."
        />
      ) : (
        <div className="flex flex-col gap-8">
          <ul className="flex flex-col gap-3">
            {open.map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="break-words">{n.text}</p>
                  <time className="text-sm text-muted-foreground" dateTime={n.created_at}>
                    {fmt.format(new Date(n.created_at))}
                  </time>
                </div>
                <form action={setParkingDoneAction.bind(null, n.id, true)}>
                  <Button variant="ghost" size="icon" aria-label="Marquer comme traitée">
                    <Check aria-hidden="true" />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
          {done.length ? (
            <section aria-labelledby="traitees" className="flex flex-col gap-3">
              <h2 id="traitees" className="text-lg font-semibold text-muted-foreground">
                Déjà traitées
              </h2>
              <ul className="flex flex-col gap-2">
                {done.map((n) => (
                  <li key={n.id} className="flex items-center gap-2 rounded-2xl px-4 py-2 text-muted-foreground">
                    <p className="min-w-0 flex-1 break-words line-through">{n.text}</p>
                    <form action={setParkingDoneAction.bind(null, n.id, false)}>
                      <Button variant="ghost" size="icon" aria-label="Remettre en attente">
                        <Undo2 aria-hidden="true" />
                      </Button>
                    </form>
                    <form action={deleteParkingAction.bind(null, n.id)}>
                      <Button variant="ghost" size="icon" aria-label="Supprimer">
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
