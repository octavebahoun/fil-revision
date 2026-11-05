"use client";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SyncEvent } from "@/lib/review/events";

export type LocalSession = {
  id: string;
  mode: string;
  plannedMinutes: number;
  items: { cardId: string; type: string; notionId: string; fresh: boolean }[];
  cards: unknown[];
  position: number;
  /** cardId → réponse donnée dans cette session (pour réafficher sans re-noter). */
  answers: Record<
    string,
    { reviewId: string; rating: number | null; correct: boolean | null; at: string; outcome: "rated" | "absent" }
  >;
  stats: { answered: number; correct: number; decroches: number };
  status: "active" | "done";
  lastActiveAt: string;
  updatedAt: string;
};

interface FilDB extends DBSchema {
  sessions: { key: string; value: LocalSession; indexes: { "by-updated": string } };
  outbox: { key: number; value: { seq?: number; event: SyncEvent; tries: number } };
  daily: { key: string; value: { key: string; savedAt: string; payload: unknown } };
}

let dbPromise: Promise<IDBPDatabase<FilDB>> | null = null;

export function localDb() {
  if (!dbPromise) {
    dbPromise = openDB<FilDB>("fil", 1, {
      upgrade(db) {
        const s = db.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("by-updated", "updatedAt");
        db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
        db.createObjectStore("daily", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}
