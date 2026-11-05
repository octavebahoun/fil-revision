"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusBadge } from "@/components/common/status-badge";

type DocStatus = {
  id: string;
  title: string;
  status: string;
  error_message: string | null;
  notions: { total: number; ready: number; error: number };
};

/**
 * Avancement en direct : interroge l'état toutes les 3 s tant qu'un traitement est en cours,
 * et relance doucement le worker (au plus toutes les 20 s).
 */
export function LiveStatus({ documentId, initial }: { documentId: string; initial: DocStatus }) {
  const [doc, setDoc] = useState(initial);
  const [budgetPaused, setBudgetPaused] = useState(false);
  const router = useRouter();
  const lastKick = useRef(0);
  const active = ["uploaded", "extracting", "segmenting", "generating"].includes(doc.status);

  useEffect(() => {
    if (!active) return;
    let stop = false;
    const tick = async () => {
      try {
        if (Date.now() - lastKick.current > 20_000) {
          lastKick.current = Date.now();
          void fetch("/api/jobs/kick", { method: "POST" });
        }
        const res = await fetch(`/api/jobs/status?document=${documentId}`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { documents: DocStatus[]; budgetPaused: boolean };
        const next = body.documents[0];
        if (!stop && next) {
          setDoc(next);
          setBudgetPaused(body.budgetPaused);
          if (!["uploaded", "extracting", "segmenting", "generating"].includes(next.status)) router.refresh();
        }
      } catch {
        /* hors ligne : on réessaiera */
      }
    };
    const t = setInterval(tick, 3000);
    void tick();
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [active, documentId, router]);

  const { total, ready } = doc.notions;
  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-card p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge status={doc.status} />
        {total > 0 ? (
          <span className="text-base text-muted-foreground">
            {ready}/{total} notions prêtes
          </span>
        ) : null}
      </div>
      {active ? (
        <ProgressBar
          value={doc.status === "generating" ? ready : doc.status === "segmenting" ? 1 : 0}
          max={doc.status === "generating" ? Math.max(total, 1) : 4}
          label="Avancement de la préparation"
        />
      ) : null}
      {budgetPaused ? (
        <p className="rounded-xl bg-warning-soft px-4 py-3">
          Le budget IA du jour est atteint. La suite reprendra demain, toute seule.
        </p>
      ) : null}
      {doc.status === "error" && doc.error_message ? (
        <p className="rounded-xl bg-warning-soft px-4 py-3">{doc.error_message}</p>
      ) : null}
      {active ? (
        <p className="text-base text-muted-foreground">Tu peux fermer cette page : la préparation continue sans toi.</p>
      ) : null}
    </div>
  );
}
