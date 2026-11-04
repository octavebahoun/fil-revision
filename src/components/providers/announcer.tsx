"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/**
 * Annonces aria-live (lecteurs d'écran) + petit message visible et calme.
 * Remplace les « toasts » : pas d'animation agressive, disparition douce.
 */
type Tone = "info" | "success" | "warning";
type Msg = { id: number; text: string; tone: Tone };

const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});

export function useAnnounce() {
  return useContext(Ctx);
}

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<Msg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const announce = useCallback((text: string, tone: Tone = "info") => {
    counter.current += 1;
    setMsg({ id: counter.current, text, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 5000);
  }, []);

  const toneClass =
    msg?.tone === "success"
      ? "bg-success-soft text-foreground border-success/40"
      : msg?.tone === "warning"
        ? "bg-warning-soft text-foreground border-warning/40"
        : "bg-card text-foreground border-border";

  return (
    <Ctx.Provider value={announce}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {msg?.text}
      </div>
      {msg ? (
        <div
          key={msg.id}
          aria-hidden="true"
          className={`fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md animate-card-in rounded-2xl border px-4 py-3 text-base shadow-md md:bottom-8 ${toneClass}`}
        >
          {msg.text}
        </div>
      ) : null}
    </Ctx.Provider>
  );
}
