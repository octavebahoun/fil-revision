"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, MIME, extensionOf, type FileKind } from "@/lib/ingest/filetype";
import { titleFromFilename } from "@/lib/ingest/classify";
import { enqueueJob, requeueJob } from "@/lib/jobs/queue";
import { runWorker } from "@/lib/jobs/run";
import { slugify } from "@/lib/text/normalize";
import { log } from "@/lib/log";

const Sha = z.string().regex(/^[a-f0-9]{64}$/);
const UploadMeta = z.object({
  subjectId: z.uuid(),
  filename: z.string().trim().min(1).max(300),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  sha256: Sha,
});

type Prepared =
  | { status: "duplicate"; documentId: string; title: string }
  | { status: "ready"; path: string; signedUrl: string }
  | { status: "error"; message: string };

function kindFromExt(filename: string): FileKind | null {
  const ext = extensionOf(filename);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) return null;
  return ext.slice(1) as FileKind;
}

/** Étape 1 de l'envoi : contrôles + URL d'envoi signée (le fichier part directement vers le stockage privé). */
export async function prepareUploadAction(input: z.infer<typeof UploadMeta>): Promise<Prepared> {
  const { user, supabase } = await requireUser();
  const parsed = UploadMeta.safeParse(input);
  if (!parsed.success)
    return { status: "error", message: "Ce fichier ne peut pas être envoyé (taille ou nom invalide, 50 Mo maximum)." };
  const kind = kindFromExt(parsed.data.filename);
  if (!kind) return { status: "error", message: "Formats acceptés : PDF, PPTX, DOCX, TXT, MD." };
  if (!(await rateLimit("upload", user.id)))
    return { status: "error", message: "Beaucoup d'envois d'un coup. Réessaie dans quelques minutes." };

  const { data: subject } = await supabase.from("subjects").select("id").eq("id", parsed.data.subjectId).maybeSingle();
  if (!subject) return { status: "error", message: "Matière introuvable." };
  const { data: dup } = await supabase
    .from("documents")
    .select("id, title")
    .eq("sha256", parsed.data.sha256)
    .maybeSingle();
  if (dup) return { status: "duplicate", documentId: dup.id, title: dup.title };

  const path = `${user.id}/${parsed.data.sha256}.${kind}`;
  const { data, error } = await createAdminClient()
    .storage.from("documents")
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    log("error", "signed_upload_failed", { code: error?.name });
    return { status: "error", message: "L'envoi n'a pas pu démarrer. Réessaie dans un instant." };
  }
  return { status: "ready", path, signedUrl: data.signedUrl };
}

/** Étape 2 : le fichier est dans le stockage → document + traitement en arrière-plan. */
export async function finalizeUploadAction(
  input: z.infer<typeof UploadMeta> & { path: string },
): Promise<{ ok: true; documentId: string } | { ok: false; message: string }> {
  const { user, supabase } = await requireUser();
  const parsed = UploadMeta.safeParse(input);
  const kind = parsed.success ? kindFromExt(parsed.data.filename) : null;
  if (!parsed.success || !kind || input.path !== `${user.id}/${parsed.data.sha256}.${kind}`) {
    return { ok: false, message: "Envoi invalide. Réessaie." };
  }
  const admin = createAdminClient();
  const { data: listed } = await admin.storage
    .from("documents")
    .list(user.id, { search: `${parsed.data.sha256}.${kind}` });
  const object = listed?.find((o) => o.name === `${parsed.data.sha256}.${kind}`);
  if (!object) return { ok: false, message: "Le fichier n'est pas arrivé. Vérifie ta connexion et réessaie." };

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      subject_id: parsed.data.subjectId,
      title: titleFromFilename(parsed.data.filename).slice(0, 300),
      filename: parsed.data.filename.normalize("NFC"),
      storage_path: input.path,
      mime: MIME[kind],
      size_bytes: parsed.data.size,
      sha256: parsed.data.sha256,
      origin: "upload",
    })
    .select("id")
    .single();
  if (error || !doc) {
    if (error?.code === "23505") {
      const { data: dup } = await supabase.from("documents").select("id").eq("sha256", parsed.data.sha256).single();
      if (dup) return { ok: true, documentId: dup.id };
    }
    return { ok: false, message: "Le cours n'a pas pu être enregistré. Réessaie." };
  }
  await enqueueJob(admin, {
    userId: user.id,
    type: "ingest_document",
    payload: { documentId: doc.id },
    dedupeKey: `ingest:${doc.id}`,
  });
  after(() => runWorker({ userId: user.id, budgetMs: 200_000 }).then(() => undefined));
  revalidatePath("/matieres", "layout");
  return { ok: true, documentId: doc.id };
}

export async function createSubjectAction(name: string): Promise<{ ok: boolean; slug?: string; message?: string }> {
  const { user, supabase } = await requireUser();
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length < 2 || clean.length > 120) return { ok: false, message: "Donne un nom entre 2 et 120 caractères." };
  const slug = slugify(clean);
  const { error } = await supabase.from("subjects").insert({ user_id: user.id, name: clean, slug });
  if (error)
    return {
      ok: false,
      message: error.code === "23505" ? "Cette matière existe déjà." : "Impossible de créer la matière.",
    };
  revalidatePath("/matieres");
  return { ok: true, slug };
}

export async function retryDocumentAction(documentId: string) {
  const { user, supabase } = await requireUser();
  const { data: doc } = await supabase
    .from("documents")
    .select("id")
    .eq("id", z.uuid().parse(documentId))
    .maybeSingle();
  if (!doc) return;
  const admin = createAdminClient();
  await admin.from("documents").update({ status: "uploaded", error_message: null }).eq("id", doc.id);
  await requeueJob(admin, user.id, `ingest:${doc.id}`);
  // Les notions en erreur sont relancées aussi.
  const { data: notions } = await admin
    .from("notions")
    .select("id, content_hash")
    .eq("document_id", doc.id)
    .eq("status", "error");
  for (const n of notions ?? []) await requeueJob(admin, user.id, `gen:${n.id}:${n.content_hash}`);
  after(() => runWorker({ userId: user.id, budgetMs: 200_000 }).then(() => undefined));
  revalidatePath(`/documents/${doc.id}`);
}

export async function deleteDocumentAction(documentId: string) {
  const { supabase } = await requireUser();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path, sha256")
    .eq("id", z.uuid().parse(documentId))
    .maybeSingle();
  if (!doc) return;
  await supabase.from("documents").delete().eq("id", doc.id);
  if (doc.storage_path) await supabase.storage.from("documents").remove([doc.storage_path]);
  revalidatePath("/matieres", "layout");
}

export async function setDocumentKindAction(documentId: string, kind: "cours" | "exercice" | "ressource") {
  const { supabase } = await requireUser();
  await supabase
    .from("documents")
    .update({ kind: z.enum(["cours", "exercice", "ressource"]).parse(kind) })
    .eq("id", z.uuid().parse(documentId));
  revalidatePath(`/documents/${documentId}`);
}

/** URL signée de courte durée (5 min) pour ouvrir le fichier original. */
export async function signedSourceUrlAction(documentId: string): Promise<string | null> {
  const { supabase } = await requireUser();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", z.uuid().parse(documentId))
    .maybeSingle();
  if (!doc?.storage_path) return null;
  const { data } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 300);
  return data?.signedUrl ?? null;
}
