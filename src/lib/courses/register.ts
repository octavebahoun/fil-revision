import { createHash } from "node:crypto";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { detectFileKind, FileRejected, MIME } from "@/lib/ingest/filetype";
import { titleFromFilename } from "@/lib/ingest/classify";
import { enqueueJob } from "@/lib/jobs/queue";

export type RegisterResult =
  | { status: "created"; documentId: string }
  | { status: "duplicate"; documentId: string; title: string }
  | { status: "rejected"; reason: string };

/**
 * Enregistre un fichier pour un utilisateur : contrôle du type réel, déduplication par empreinte,
 * dépôt dans le stockage privé, création du document et du job d'ingestion.
 * Utilisé par l'import en masse (CLI). L'upload navigateur passe par prepare/finalize.
 */
export async function registerFile(
  db: AdminSupabase,
  args: {
    userId: string;
    subjectId: string;
    filename: string;
    bytes: Uint8Array;
    origin: "import" | "upload" | "demo";
    /** Génère sans attendre de confirmation, même si l'estimation dépasse le seuil. */
    autoConfirm?: boolean;
  },
): Promise<RegisterResult> {
  let kind;
  try {
    kind = await detectFileKind(args.bytes, args.filename);
  } catch (err) {
    if (err instanceof FileRejected) return { status: "rejected", reason: err.reason };
    throw err;
  }
  const sha256 = createHash("sha256").update(args.bytes).digest("hex");
  const { data: existing } = await db
    .from("documents")
    .select("id, title")
    .eq("user_id", args.userId)
    .eq("sha256", sha256)
    .maybeSingle();
  if (existing) return { status: "duplicate", documentId: existing.id, title: existing.title };

  const path = `${args.userId}/${sha256}.${kind}`;
  const { error: upErr } = await db.storage
    .from("documents")
    .upload(path, args.bytes, { contentType: MIME[kind], upsert: true });
  if (upErr) throw upErr;

  const { data: doc, error } = await db
    .from("documents")
    .insert({
      user_id: args.userId,
      subject_id: args.subjectId,
      title: titleFromFilename(args.filename).slice(0, 300),
      filename: args.filename.normalize("NFC").slice(0, 300),
      storage_path: path,
      mime: MIME[kind],
      size_bytes: args.bytes.length,
      sha256,
      origin: args.origin,
    })
    .select("id")
    .single();
  if (error) throw error;
  await enqueueJob(db, {
    userId: args.userId,
    type: "ingest_document",
    payload: { documentId: doc.id, autoConfirm: args.autoConfirm === true },
    dedupeKey: `ingest:${doc.id}`,
  });
  return { status: "created", documentId: doc.id };
}

/** Crée (ou retrouve) une matière par son slug. */
export async function ensureSubject(
  db: AdminSupabase,
  args: {
    userId: string;
    name: string;
    slug: string;
    kind: "matiere" | "ressources";
    language?: "fr" | "en";
    position?: number;
  },
): Promise<string> {
  const { data: found } = await db
    .from("subjects")
    .select("id")
    .eq("user_id", args.userId)
    .eq("slug", args.slug)
    .maybeSingle();
  if (found) return found.id;
  const { data, error } = await db
    .from("subjects")
    .insert({
      user_id: args.userId,
      name: args.name.slice(0, 200),
      slug: args.slug,
      kind: args.kind,
      language: args.language ?? "fr",
      position: args.position ?? 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
