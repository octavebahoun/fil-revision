import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="mt-4 h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
