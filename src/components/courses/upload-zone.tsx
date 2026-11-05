"use client";
import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { CheckCircle2, FileUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/common/progress-bar";
import { useAnnounce } from "@/components/providers/announcer";
import { finalizeUploadAction, prepareUploadAction } from "@/lib/courses/actions";

const ACCEPT = ".pdf,.pptx,.docx,.txt,.md";
const MAX = 50 * 1024 * 1024;

type Item = {
  name: string;
  state: "hash" | "upload" | "done" | "dup" | "error";
  progress: number;
  message?: string;
  documentId?: string;
};

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function putWithProgress(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error("network"));
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    xhr.send(body);
  });
}

/** Glisser-déposer : PDF, PPTX, DOCX, TXT, MD (50 Mo max). Le fichier va directement au stockage privé. */
export function UploadZone({ subjectId }: { subjectId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const announce = useAnnounce();
  const hintId = useId();

  const update = (i: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      const offset = items.length;
      setItems((prev) => [...prev, ...list.map((f) => ({ name: f.name, state: "hash" as const, progress: 0 }))]);
      for (const [k, file] of list.entries()) {
        const i = offset + k;
        try {
          if (file.size > MAX) throw new Error("Ce fichier dépasse 50 Mo.");
          if (file.size === 0) throw new Error("Ce fichier est vide.");
          const hash = await sha256(file);
          const meta = { subjectId, filename: file.name, size: file.size, sha256: hash };
          const prep = await prepareUploadAction(meta);
          if (prep.status === "error") throw new Error(prep.message);
          if (prep.status === "duplicate") {
            update(i, {
              state: "dup",
              progress: 1,
              documentId: prep.documentId,
              message: `Déjà importé : « ${prep.title} ».`,
            });
            continue;
          }
          update(i, { state: "upload" });
          await putWithProgress(prep.signedUrl, file, (p) => update(i, { progress: p }));
          const fin = await finalizeUploadAction({ ...meta, path: prep.path });
          if (!fin.ok) throw new Error(fin.message);
          update(i, {
            state: "done",
            progress: 1,
            documentId: fin.documentId,
            message: "Reçu. La préparation démarre.",
          });
          announce(`${file.name} est bien arrivé. On prépare tes cartes.`, "success");
        } catch (err) {
          const message =
            err instanceof Error && err.message.length > 3 && !/^\d+$/.test(err.message) && err.message !== "network"
              ? err.message
              : "L'envoi a échoué. Vérifie ta connexion et réessaie.";
          update(i, { state: "error", message });
        }
      }
      router.refresh();
    },
    [announce, items.length, router, subjectId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-200 ${
          drag ? "border-primary bg-secondary" : "border-input bg-card"
        }`}
      >
        <FileUp className="size-10 text-primary" aria-hidden="true" />
        <p className="text-lg font-semibold">Glisse ton cours ici</p>
        <p id={hintId} className="text-muted-foreground">
          PDF, PowerPoint, Word, texte ou Markdown. 50 Mo maximum.
        </p>
        <Button type="button" size="lg" onClick={() => inputRef.current?.click()} aria-describedby={hintId}>
          Choisir un fichier
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {items.length ? (
        <ul className="flex flex-col gap-3" aria-live="polite">
          {items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2">
                {it.state === "done" || it.state === "dup" ? (
                  <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
                ) : it.state === "error" ? (
                  <AlertCircle className="size-5 shrink-0 text-warning" aria-hidden="true" />
                ) : null}
                <span className="truncate font-medium">{it.name}</span>
              </div>
              {it.state === "hash" || it.state === "upload" ? (
                <ProgressBar value={Math.round(it.progress * 100)} max={100} label={`Envoi de ${it.name}`} />
              ) : null}
              {it.message ? <p className="text-base text-muted-foreground">{it.message}</p> : null}
              {it.documentId && (it.state === "done" || it.state === "dup") ? (
                <a href={`/documents/${it.documentId}`} className="min-h-11 content-center font-semibold text-primary">
                  Voir l&apos;avancement
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
