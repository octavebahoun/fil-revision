import { createHash } from "node:crypto";
import type { Json } from "@/lib/database.types";
import { detectFileKind, FileRejected, MAX_FILE_BYTES } from "@/lib/ingest/filetype";
import { extractPages, ExtractTimeout } from "@/lib/ingest/extract";
import { cleanPages } from "@/lib/ingest/clean";
import { classifyDocument } from "@/lib/ingest/classify";
import { detectLanguage } from "@/lib/text/normalize";
import {
  SegmentOutput,
  buildSegmentPrompt,
  mergeAcrossWindows,
  mockSegment,
  notionSourceText,
  sanitizeSegment,
  segmentWindows,
  type PageText,
} from "@/lib/ai/tasks/segment";
import { enqueueJob } from "../queue";
import { enqueueGeneration } from "../plan";
import { estimateDocumentCostUsd } from "@/lib/ai/estimate";
import { JobFatal, type JobContext, type JobHandler, type JobRow, type StepResult } from "../types";

type Payload = { documentId: string; window?: number; autoConfirm?: boolean };

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const GENERIC_TITLE = /^(cours ?slides?|polyc(opi[ée])?|diapos?|slides?|support|cours|document|notes?)$/i;

async function loadDoc(ctx: JobContext, job: JobRow) {
  const { documentId } = job.payload as Payload;
  const { data: doc, error } = await ctx.db
    .from("documents")
    .select("*, subjects!inner(kind, name, language)")
    .eq("id", documentId)
    .eq("user_id", job.user_id)
    .maybeSingle();
  if (error) throw error;
  if (!doc) throw new JobFatal("Document introuvable.");
  return doc;
}

async function loadPages(ctx: JobContext, documentId: string): Promise<PageText[]> {
  const { data, error } = await ctx.db
    .from("document_pages")
    .select("page_number, text")
    .eq("document_id", documentId)
    .order("page_number");
  if (error) throw error;
  return (data ?? []).filter((p) => p.text.trim().length > 0).map((p) => ({ page: p.page_number, text: p.text }));
}

async function stepExtract(ctx: JobContext, job: JobRow): Promise<StepResult> {
  const doc = await loadDoc(ctx, job);
  await ctx.db.from("documents").update({ status: "extracting", error_message: null }).eq("id", doc.id);
  if (!doc.storage_path) throw new JobFatal("Le fichier n'a pas été reçu. Réessaie l'envoi.");
  const { data: blob, error } = await ctx.db.storage.from("documents").download(doc.storage_path);
  if (error || !blob) throw new Error("download_failed");
  if (blob.size > MAX_FILE_BYTES) throw new JobFatal("Le fichier dépasse 50 Mo.");
  const bytes = new Uint8Array(await blob.arrayBuffer());

  // Le fichier déposé doit être exactement celui annoncé (empreinte) et d'un type réellement accepté.
  if (createHash("sha256").update(bytes).digest("hex") !== doc.sha256) {
    throw new JobFatal("Le fichier reçu ne correspond pas à celui envoyé. Réessaie l'envoi.");
  }
  let pages: string[];
  try {
    const kind = await detectFileKind(bytes, doc.filename);
    pages = cleanPages(await extractPages(bytes, kind));
  } catch (err) {
    if (err instanceof FileRejected) throw new JobFatal(err.reason);
    if (err instanceof ExtractTimeout)
      throw new JobFatal("Ce fichier est trop long à lire. Essaie de le découper en plusieurs parties.");
    throw new JobFatal("Ce fichier semble abîmé : impossible d'en lire le texte.");
  }
  const fullText = pages.join("\n");
  if (fullText.replace(/\s/g, "").length < 50) {
    throw new JobFatal(
      "Aucun texte lisible dans ce fichier (c'est peut-être un scan). Les fichiers scannés ne sont pas encore pris en charge.",
    );
  }
  const subject = doc.subjects as unknown as { kind: "matiere" | "ressources"; language: "fr" | "en" };
  const language = detectLanguage(fullText);
  const kind =
    doc.origin === "demo" ? doc.kind : classifyDocument({ filename: doc.filename, subjectKind: subject.kind, pages });

  await ctx.db.from("document_pages").delete().eq("document_id", doc.id);
  for (let i = 0; i < pages.length; i += 200) {
    const rows = pages.slice(i, i + 200).map((text, j) => ({
      user_id: job.user_id,
      document_id: doc.id,
      page_number: i + j + 1,
      language,
      text,
    }));
    const { error: insErr } = await ctx.db.from("document_pages").insert(rows);
    if (insErr) throw insErr;
  }
  await ctx.db
    .from("documents")
    .update({ page_count: pages.length, language, kind, status: "segmenting" })
    .eq("id", doc.id);
  const windows = segmentWindows(pages.map((text, i) => ({ page: i + 1, text })).filter((p) => p.text.trim()));
  return { kind: "continue", step: "segment", payload: { window: 0 }, progress: 0, total: windows.length };
}

async function stepSegment(ctx: JobContext, job: JobRow): Promise<StepResult> {
  const doc = await loadDoc(ctx, job);
  if (doc.kind === "exercice") return { kind: "continue", step: "plan" };
  const pages = await loadPages(ctx, doc.id);
  const windows = segmentWindows(pages);
  const index = (job.payload as Payload).window ?? 0;
  const win = windows[index];
  if (!win) return { kind: "continue", step: "plan", progress: windows.length, total: windows.length };

  const first = index === 0;
  const prompt = buildSegmentPrompt(win, { documentTitle: doc.title, first, language: doc.language as "fr" | "en" });
  const { data } = await ctx.ai.generate({
    userId: job.user_id,
    purpose: "segment",
    tier: "main",
    schema: SegmentOutput,
    system: prompt.system,
    user: prompt.user,
    maxTokens: 6000,
    reasoning: "off",
    cacheKey: `seg:v1:${sha(doc.title + "\u0000" + win.map((p) => `${p.page}:${p.text}`).join("\u0000"))}`,
    mock: () => mockSegment(win, first),
  });
  const notions = sanitizeSegment(data, win);
  const byPage = new Map(pages.map((p) => [p.page, p.text]));
  const subject = doc.subjects as unknown as { name: string };

  if (first && data.documentTitle && GENERIC_TITLE.test(doc.title.trim())) {
    await ctx.db
      .from("documents")
      .update({ title: data.documentTitle.slice(0, 200) })
      .eq("id", doc.id);
  }

  // Fusion avec la dernière notion de la fenêtre précédente si elle continue sur cette page.
  let rest = notions;
  if (index > 0) {
    const { data: prev } = await ctx.db
      .from("notions")
      .select("id, title, pages")
      .eq("document_id", doc.id)
      .lt("position", index * 1000)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prev) {
      const holder = { title: prev.title, pages: prev.pages };
      const merged = mergeAcrossWindows(holder, notions);
      rest = merged.rest;
      if (merged.mergedIntoPrev) {
        const source = notionSourceText(holder.pages, byPage);
        await ctx.db
          .from("notions")
          .update({ pages: holder.pages, source_text: source, content_hash: sha(holder.title + source) })
          .eq("id", prev.id);
      }
    }
  }
  if (rest.length) {
    const rows = rest.map((n, j) => {
      const source = notionSourceText(n.pages, byPage);
      return {
        user_id: job.user_id,
        document_id: doc.id,
        subject_id: doc.subject_id,
        title: n.title,
        pages: n.pages,
        position: index * 1000 + j,
        language: doc.language,
        source_text: source,
        content_hash: sha(`${subject.name}\u0000${n.title}\u0000${source}`),
      };
    });
    const { error } = await ctx.db.from("notions").upsert(rows, { onConflict: "document_id,position" });
    if (error) throw error;
  }
  // Une relance plus courte ne doit pas laisser de notions orphelines de cette fenêtre.
  await ctx.db
    .from("notions")
    .delete()
    .eq("document_id", doc.id)
    .gte("position", index * 1000 + rest.length)
    .lt("position", (index + 1) * 1000);

  const next = index + 1;
  if (next < windows.length)
    return { kind: "continue", step: "segment", payload: { window: next }, progress: next, total: windows.length };
  return { kind: "continue", step: "plan", progress: windows.length, total: windows.length };
}

async function stepPlan(ctx: JobContext, job: JobRow): Promise<StepResult> {
  const doc = await loadDoc(ctx, job);
  if (doc.kind === "exercice") {
    await enqueueJob(ctx.db, {
      userId: job.user_id,
      type: "exercise_guide",
      payload: { documentId: doc.id } as Record<string, Json>,
      dedupeKey: `guide:${doc.id}:${doc.sha256}`,
    });
    await ctx.db.from("documents").update({ status: "generating" }).eq("id", doc.id);
    return { kind: "done" };
  }
  const { data: notions, error } = await ctx.db.from("notions").select("source_text, status").eq("document_id", doc.id);
  if (error) throw error;
  const todo = (notions ?? []).filter((n) => n.status !== "ready");
  // Estimation avant une génération massive : au-delà du seuil, on attend ta confirmation.
  const estimate = estimateDocumentCostUsd(
    todo.map((n) => n.source_text.length),
    ctx.config.models,
  );
  await ctx.db
    .from("documents")
    .update({ estimated_cost_usd: Number(estimate.toFixed(4)) })
    .eq("id", doc.id);
  const autoConfirm = (job.payload as Payload).autoConfirm === true;
  if (todo.length && !autoConfirm && estimate > ctx.config.confirmThresholdUsd) {
    await ctx.db.from("documents").update({ status: "awaiting_confirmation" }).eq("id", doc.id);
    return { kind: "done" };
  }
  await enqueueGeneration(ctx.db, job.user_id, doc.id);
  return { kind: "done" };
}

export const ingestHandler: JobHandler = {
  async run(job, ctx) {
    switch (job.step) {
      case "start":
      case "extract":
        return stepExtract(ctx, job);
      case "segment":
        return stepSegment(ctx, job);
      case "plan":
        return stepPlan(ctx, job);
      default:
        throw new JobFatal(`Étape inconnue : ${job.step}`);
    }
  },
  async onFail(job, ctx, message) {
    const { documentId } = job.payload as Payload;
    await ctx.db
      .from("documents")
      .update({ status: "error", error_message: message })
      .eq("id", documentId)
      .eq("user_id", job.user_id);
  },
};
