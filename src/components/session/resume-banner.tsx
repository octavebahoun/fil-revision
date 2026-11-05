"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * « Où j'en étais ? » — bandeau calme (fondu lent, pas de flash) qui aide à se raccrocher
 * après une absence : dernier élément vu, un rappel d'une ligne, un bouton « Reprendre ».
 */
export function ResumeBanner({
  title,
  reminder,
  progress,
  onResume,
}: {
  title: string;
  reminder: string;
  progress: string;
  onResume: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        onResume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onResume]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/15 p-4 sm:items-center"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ou-j-en-etais"
        className="flex w-full max-w-md animate-card-in flex-col gap-4 rounded-3xl border bg-card p-6 shadow-lg [animation-duration:420ms]"
      >
        <h2 id="ou-j-en-etais" className="text-xl font-bold">
          Où j&apos;en étais ?
        </h2>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Tu révisais ({progress}) :</p>
          <p className="text-lg font-semibold">{title}</p>
          {reminder ? <p className="line-clamp-1 text-muted-foreground">{reminder}</p> : null}
        </div>
        <Button ref={ref} size="lg" onClick={onResume}>
          Reprendre
        </Button>
      </section>
    </div>
  );
}
