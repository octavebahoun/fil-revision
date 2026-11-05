"use client";
import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

/** « En savoir plus » : le reste du texte, caché par défaut (5 lignes visibles au plus). */
export function MoreDetails({ children, label = "En savoir plus" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl px-1 text-base font-semibold text-primary"
      >
        <ChevronDown
          className={`size-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        {open ? "Masquer" : label}
      </button>
      <div id={id} hidden={!open} className="reading-block animate-fade-in text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
