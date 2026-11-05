"use client";
import { useMemo } from "react";

/**
 * Célébration de fin de session : particules lentes (1,8 s) qui montent doucement.
 * Couleurs pastel proches du fond : aucun saut de luminosité, aucun flash.
 * Désactivée en mouvement « aucun », réduite à un fondu en mouvement « réduit ».
 */
export function Celebration() {
  const dots = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: 8 + ((i * 53) % 84),
        delay: (i % 7) * 140,
        size: 10 + ((i * 7) % 10),
        color: ["var(--celebrate-1)", "var(--celebrate-2)", "var(--celebrate-3)"][i % 3],
      })),
    [],
  );
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-64 overflow-hidden">
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute bottom-0 animate-float-up rounded-full"
          style={{
            left: `${d.left}%`,
            width: d.size,
            height: d.size,
            background: d.color,
            animationDelay: `${d.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}
