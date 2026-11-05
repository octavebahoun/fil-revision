import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-card/60 px-6 py-10 text-center">
      <Icon className="size-10 text-primary" aria-hidden="true" />
      <h2 className="text-xl font-semibold">{title}</h2>
      {text ? <p className="reading-block text-muted-foreground">{text}</p> : null}
      {action}
    </div>
  );
}
