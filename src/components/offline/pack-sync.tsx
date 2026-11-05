"use client";
import { useEffect } from "react";
import { localDb, type LocalSession } from "@/lib/offline/db";

/** Télécharge une fois par jour le pack de révision hors ligne (en silence, si le réseau est là). */
export function OfflinePackSync() {
  useEffect(() => {
    if (!navigator.onLine) return;
    const run = async () => {
      try {
        const db = await localDb();
        const meta = (await db.get("daily", "pack")) as
          { key: string; savedAt: string; payload: { day: string; sessionId: string } } | undefined;
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
        if (meta?.payload.day === today) return;
        const res = await fetch("/api/offline/pack", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as {
          day: string;
          session: Omit<LocalSession, "cards" | "answers" | "stats" | "lastActiveAt" | "updatedAt"> | null;
          cards: unknown[];
        };
        if (!body.session) return;
        const existing = await db.get("sessions", body.session.id);
        const now = new Date().toISOString();
        if (!existing) {
          await db.put("sessions", {
            ...body.session,
            cards: body.cards,
            answers: {},
            stats: { answered: 0, correct: 0, decroches: 0 },
            lastActiveAt: now,
            updatedAt: "1970-01-01T00:00:00.000Z",
          } as LocalSession);
        }
        await db.put("daily", { key: "pack", savedAt: now, payload: { day: body.day, sessionId: body.session.id } });
        // Les pages utiles hors ligne sont mises en cache par le service worker.
        void fetch(`/session/${body.session.id}`).catch(() => {});
        navigator.serviceWorker?.controller?.postMessage("precache-offline");
      } catch {
        /* sans réseau ou sans IndexedDB : on réessaiera demain */
      }
    };
    const t = setTimeout(run, 3000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
