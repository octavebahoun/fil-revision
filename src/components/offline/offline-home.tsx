"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionRunner } from "@/components/session/session-runner";
import { localDb, type LocalSession } from "@/lib/offline/db";
import type { SessionCard } from "@/lib/review/sessions";

/** Hors ligne : reprendre la session en cours ou réviser le pack du jour, depuis IndexedDB. */
export function OfflineHome() {
  const [sessions, setSessions] = useState<LocalSession[] | null>(null);
  const [active, setActive] = useState<LocalSession | null>(null);

  useEffect(() => {
    localDb()
      .then((db) => db.getAll("sessions"))
      .then((all) =>
        setSessions(
          all
            .filter((s) => s.status === "active" && s.position < s.items.length)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        ),
      )
      .catch(() => setSessions([]));
  }, []);

  if (active) {
    return (
      <SessionRunner
        session={{
          id: active.id,
          mode: active.mode,
          plannedMinutes: active.plannedMinutes,
          items: active.items,
          position: active.position,
          status: "active",
        }}
        cards={active.cards as SessionCard[]}
      />
    );
  }
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <WifiOff className="size-8 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Tu es hors ligne</h1>
      </div>
      <p className="reading-block text-muted-foreground">
        Pas de souci : tu peux réviser quand même. Tes réponses partiront au retour du réseau.
      </p>
      {sessions === null ? (
        <p className="animate-calm-pulse">Je cherche tes cartes…</p>
      ) : sessions.length ? (
        <div className="flex flex-col gap-3">
          {sessions.slice(0, 3).map((s, i) => (
            <Button
              key={s.id}
              size={i === 0 ? "xl" : "lg"}
              variant={i === 0 ? "default" : "outline"}
              onClick={() => setActive(s)}
            >
              {s.position > 0
                ? `Reprendre (${s.position + 1}/${s.items.length})`
                : `Réviser hors ligne (${s.items.length} éléments)`}
            </Button>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-info-soft px-4 py-3">
          Aucune carte gardée sur cet appareil. Ouvre Fil une fois avec du réseau : le pack du jour sera prêt.
        </p>
      )}
    </section>
  );
}
