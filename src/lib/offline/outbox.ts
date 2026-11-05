"use client";
import type { SyncEvent } from "@/lib/review/events";
import { localDb } from "./db";

/**
 * File d'envoi : chaque interaction est écrite tout de suite dans IndexedDB, puis envoyée
 * au serveur dans l'ordre. Hors ligne, rien n'est perdu ; au retour du réseau, tout part,
 * sans doublon (identifiants uniques côté serveur).
 */
let flushing: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(pending: number) => void>();

export function onPendingChange(cb: (pending: number) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

async function notify() {
  const db = await localDb();
  const n = await db.count("outbox");
  for (const l of listeners) l(n);
}

export async function enqueue(event: SyncEvent) {
  const db = await localDb();
  await db.add("outbox", { event, tries: 0 });
  void notify();
  scheduleFlush(250);
}

export function scheduleFlush(delay = 250) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), delay);
}

export function flush(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const db = await localDb();
      for (;;) {
        const batch = (await db.getAll("outbox", undefined, 50)) as { seq: number; event: SyncEvent; tries: number }[];
        if (!batch.length) break;
        let res: Response;
        try {
          res = await fetch("/api/sync", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ events: batch.map((b) => b.event) }),
            keepalive: true,
          });
        } catch {
          scheduleFlush(5000);
          break;
        }
        if (res.status === 400) {
          // Événements invalides : on les écarte pour ne pas bloquer la file.
          const tx = db.transaction("outbox", "readwrite");
          for (const b of batch) await tx.store.delete(b.seq);
          await tx.done;
          continue;
        }
        if (!res.ok) {
          scheduleFlush(res.status === 401 ? 30_000 : 8000);
          break;
        }
        const tx = db.transaction("outbox", "readwrite");
        for (const b of batch) await tx.store.delete(b.seq);
        await tx.done;
      }
    } finally {
      flushing = null;
      void notify();
    }
  })();
  return flushing;
}

let started = false;
/** Relance l'envoi au retour du réseau, au retour sur l'onglet et toutes les 30 s. */
export function startOutbox() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => scheduleFlush(100));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleFlush(100);
    else void flush();
  });
  setInterval(() => scheduleFlush(0), 30_000);
  scheduleFlush(500);
}

export async function pendingCount() {
  return (await localDb()).count("outbox");
}
