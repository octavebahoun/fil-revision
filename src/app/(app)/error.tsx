"use client";
import { useEffect } from "react";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    document.title = "Petit souci · Fil";
  }, []);
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-3xl border bg-card px-6 py-10 text-center">
      <CloudOff className="size-10 text-primary" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="reading-block text-muted-foreground">Rien n&apos;est perdu. Vérifie ta connexion, puis réessaie.</p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
