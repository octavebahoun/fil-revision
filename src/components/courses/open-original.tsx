"use client";
import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signedSourceUrlAction } from "@/lib/courses/actions";

/** Ouvre le fichier original via une URL signée de 5 minutes (PDF : directement à la bonne page). */
export function OpenOriginal({ documentId, page, isPdf }: { documentId: string; page: number; isPdf: boolean }) {
  const [error, setError] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="w-fit"
        onClick={async () => {
          const url = await signedSourceUrlAction(documentId);
          if (!url) return setError(true);
          window.open(isPdf ? `${url}#page=${page}` : url, "_blank", "noopener,noreferrer");
        }}
      >
        <FileText aria-hidden="true" /> Ouvrir le fichier original
      </Button>
      {error ? <p role="alert">Le fichier n&apos;est pas disponible pour le moment.</p> : null}
    </div>
  );
}
