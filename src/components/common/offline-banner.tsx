"use client";
import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Bandeau calme quand le réseau est coupé : rien n'est perdu. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="hide-in-focus sticky top-0 z-30 flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-base"
    >
      <WifiOff className="size-5" aria-hidden="true" />
      Hors ligne. Tes réponses sont gardées et partiront au retour du réseau.
    </div>
  );
}
