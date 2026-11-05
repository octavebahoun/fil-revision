import Link from "next/link";
import { BookOpen } from "lucide-react";

/** Citation de la source : un clic ouvre le document à la bonne page. */
export function SourceLink({ documentId, pages, title }: { documentId: string; pages: number[]; title?: string }) {
  const page = pages[0] ?? 1;
  const label = pages.length > 1 ? `p. ${pages.join(", ")}` : `p. ${page}`;
  return (
    <Link
      href={`/documents/${documentId}/page/${page}`}
      className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
    >
      <BookOpen className="size-4" aria-hidden="true" />
      Source : {title ? `${title}, ` : ""}
      {label}
    </Link>
  );
}
