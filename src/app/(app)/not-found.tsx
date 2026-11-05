import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border bg-card px-6 py-10 text-center">
      <h1 className="text-xl font-semibold">On ne trouve pas cette page</h1>
      <p className="text-muted-foreground">Elle a peut-être été supprimée.</p>
      <Button asChild>
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </div>
  );
}
