"use client";
import type { SyncEvent } from "@/lib/review/events";
import { localDb } from "./db";

/**
 * File d'envoi : chaque interaction est écrite tout de suite dans IndexedDB, puis envoyée
 * au serveur dans l'ordre. Hors ligne, rien n'est perdu ; au retour du réseau, tout part,
 * sans doublon (identifiants uniques côté serveur).
 */
let flushing: Promise<void> | null = null;
/** Requête d'envoi en cours : annulée quand le réseau change (une requête coupée peut rester bloquée). */
let inflight: AbortController | null = null;
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
  // Le verrou est relâché dans .finally() (asynchrone). Un relâchement synchrone, quand l'envoi
  // se termine immédiatement (hors ligne), serait écrasé par cette affectation et bloquerait la file.
  flushing = sendAll().finally(() => {
    flushing = null;
    void notify();
  });
  return flushing;
}

type Queued = { seq: number; event: SyncEvent; tries: number };

async function deleteBatch(batch: Queued[]) {
  const db = await localDb();
  const tx = db.transaction("outbox", "readwrite");
  for (const b of batch) await tx.store.delete(b.seq);
  await tx.done;
}

async function sendAll(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    // Hors ligne : on réessaiera au retour du réseau (événement « online ») ou dans 10 s.
    scheduleFlush(10_000);
    return;
  }
  const db = await localDb();
  for (;;) {
    const batch = (await db.getAll("outbox", undefined, 50)) as Queued[];
    if (!batch.length) return;
    let res: Response;
    try {
      inflight = new AbortController();
      res = await fetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: batch.map((b) => b.event) }),
        // keepalive seulement quand la page se ferme ; le délai maximal évite qu'une requête
        // coupée par une perte de réseau ne fige la file.
        keepalive: document.visibilityState === "hidden",
        signal: AbortSignal.any([inflight.signal, AbortSignal.timeout(8_000)]),
      });
    } catch {
      scheduleFlush(navigator.onLine ? 2000 : 10_000);
      return;
    } finally {
      inflight = null;
    }
    if (res.status === 400) {
      // Événements invalides : on les écarte pour ne pas bloquer la file.
      await deleteBatch(batch);
      continue;
    }
    if (!res.ok) {
      scheduleFlush(res.status === 401 ? 30_000 : 8000);
      return;
    }
    await deleteBatch(batch);
  }
}

let started = false;
/** Relance l'envoi au retour du réseau, au retour sur l'onglet et toutes les 30 s. */
export function startOutbox() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => {
    inflight?.abort();
    scheduleFlush(150);
  });
  window.addEventListener("offline", () => inflight?.abort());
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
