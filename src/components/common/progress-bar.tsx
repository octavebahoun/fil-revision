/** Barre de progression qui se remplit (transform uniquement, 60 fps). */
export function ProgressBar({
  value,
  max,
  label,
  className = "",
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`h-2.5 w-full overflow-hidden rounded-full bg-muted ${className}`}
    >
      <div className="progress-fill h-full w-full rounded-full bg-primary" style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}
