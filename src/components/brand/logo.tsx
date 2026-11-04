/** Logo Fil : un fil qui ondule doucement et se noue en une boucle. */
export function Logo({ className = "h-8 w-auto", withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-primary">
      <svg viewBox="0 0 48 32" className={className} aria-hidden="true" fill="none">
        <path
          d="M3 22c6 0 8-12 15-12s6 14 13 14c4 0 6-4 5-7s-5-3-6 0 2 7 8 7h7"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withText ? <span className="text-2xl font-bold tracking-tight text-foreground">Fil</span> : null}
    </span>
  );
}
