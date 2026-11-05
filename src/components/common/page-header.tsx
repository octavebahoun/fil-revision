import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/** En-tête d'écran : un titre, éventuellement un retour, et au plus UNE action principale. */
export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3">
      {back ? (
        <Link
          href={back.href}
          className="hide-in-focus -ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-xl px-2 text-base text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl leading-tight font-bold text-balance md:text-3xl">{title}</h1>
          {subtitle ? <div className="text-base text-muted-foreground">{subtitle}</div> : null}
        </div>
        {action}
      </div>
    </header>
  );
}
