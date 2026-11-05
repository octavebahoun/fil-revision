import { AlertCircle, CheckCircle2, Clock, Loader } from "lucide-react";

const LABELS: Record<string, { label: string; tone: "wait" | "ok" | "warn" }> = {
  uploaded: { label: "En attente", tone: "wait" },
  extracting: { label: "Lecture du fichier", tone: "wait" },
  segmenting: { label: "Découpage en notions", tone: "wait" },
  awaiting_confirmation: { label: "À confirmer", tone: "warn" },
  generating: { label: "Préparation des cartes", tone: "wait" },
  ready: { label: "Prêt", tone: "ok" },
  error: { label: "À vérifier", tone: "warn" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = LABELS[status] ?? { label: status, tone: "wait" as const };
  const Icon =
    s.tone === "ok" ? CheckCircle2 : s.tone === "warn" ? AlertCircle : status === "uploaded" ? Clock : Loader;
  const cls =
    s.tone === "ok"
      ? "bg-success-soft text-foreground"
      : s.tone === "warn"
        ? "bg-warning-soft text-foreground"
        : "bg-info-soft text-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${cls}`}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function isProcessing(status: string) {
  return ["uploaded", "extracting", "segmenting", "generating"].includes(status);
}
