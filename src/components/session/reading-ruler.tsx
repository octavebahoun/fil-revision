"use client";
import { useEffect, useRef } from "react";

/** Règle de lecture : une bande douce qui suit la ligne pointée (souris ou doigt). */
export function ReadingRuler() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translateY(${e.clientY - 18}px)`;
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-30 h-9 bg-ruler"
      style={{ transform: "translateY(40vh)", height: "calc(var(--reading-size) * var(--reading-leading) + 6px)" }}
    />
  );
}
