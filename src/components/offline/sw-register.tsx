"use client";
import { useEffect } from "react";

/** Enregistre le service worker (production uniquement : en dev, le cache gênerait le rechargement). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
