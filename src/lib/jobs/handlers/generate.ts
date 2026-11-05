import type { Json } from "@/lib/database.types";
import {
  GenFicheOutput,
  GenQuizOutput,
  buildFichePrompt,
  buildQuizPrompt,
  ficheCheck,
  mockFiche,
  mockQuiz,
  type NotionInput,
} from "@/lib/ai/tasks/generate";
import {
  VerifyOutput,
  buildVerifyPrompt,
  deterministicCheck,
  mockVerify,
  type VerifiableItem,
} from "@/lib/ai/tasks/verify";
import { AiError } from "@/lib/ai/types";
import { log } from "@/lib/log";
import { JobFatal, type JobContext, type JobHandler, type JobRow, type StepResult } from "../types";

type Payload = {
  notionId: string;
  fiche?: GenFicheOutput | null;
  quiz?: GenQuizOutput | null;
  rejected?: string[];
  ficheRetry?: number;
  feedback?: string;
};

export const GEN_VERSION = "v1";

async function loadNotion(ctx: JobContext, job: JobRow) {
  const { notionId } = job.payload as Payload;
  const { data, error } = await ctx.db
    .from("notions")
    .select("*, subjects!inner(name), documents!inner(kind, title)")
    .eq("id", notionId)
    .eq("user_id", job.user_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new JobFatal("Notion introuvable.");
  return data;
}

function toInput(n: Awaited<ReturnType<typeof loadNotion>>, feedback?: string): NotionInput {
  return {
    title: n.title,
    subject: (n.subjects as unknown as { name: string }).name,
    pages: n.pages,
    sourceText: n.source_text,
    language: n.language as "fr" | "en",
    feedback,
  };
}

const HAS_CODE =
  /(<\/?[a-z][\w-]*[^>]*>|\b(SELECT|INSERT|CREATE TABLE|function|const|let|import|echo|\$[a-z_]+|=>|class \w+|npm |pnpm |docker )\b|[{};]\s*$)/im;

/** Éléments à vérifier, avec un identifiant stable. */
export function verifiableItems(p: Payload): VerifiableItem[] {
  const items: VerifiableItem[] = [];
  if (p.fiche) {
    const f = p.fiche.fiche;
    items.push({
      id: "fiche",
      type: "fiche",
      text: `${f.explanation} | Exemple : ${f.example} | Question : ${f.question} → ${f.answer}${f.more ? ` | Plus : ${f.more}` : ""}`,
      sourceQuote: f.sourceQuote,
      sourcePages: f.sourcePages,
    });
    p.fiche.flashcards.forEach((c, i) =>
      items.push({
        id: `f${i}`,
        type: "flashcard",
        text: `${c.front} → ${c.back}`,
        sourceQuote: c.sourceQuote,
        sourcePages: c.sourcePages,
      }),
    );
    p.fiche.vocab.forEach((v, i) =>
      items.push({
        id: `v${i}`,
        type: "vocab",
        text: `${v.en} = ${v.fr}. ${v.example}`,
        sourceQuote: v.sourceQuote,
        sourcePages: v.sourcePages,
      }),
    );
    p.fiche.phrases.forEach((v, i) =>
      items.push({
        id: `p${i}`,
        type: "phrase",
        text: `${v.en} = ${v.fr}`,
        sourceQuote: v.sourceQuote,
        sourcePages: v.sourcePages,
      }),
    );
  }
  p.quiz?.quiz.forEach((q, i) => {
    const { sourceQuote, sourcePages, ...rest } = q;
    items.push({ id: `q${i}`, type: q.type, text: JSON.stringify(rest), sourceQuote, sourcePages });
  });
  return items;
}

async function stepFiche(ctx: JobContext, job: JobRow): Promise<StepResult> {
  const p = job.payload as Payload;
  const n = await loadNotion(ctx, job);
  await ctx.db.from("notions").update({ status: "generating", error_message: null }).eq("id", n.id);
  const input = toInput(n, p.feedback);
  const prompt = buildFichePrompt(input);
  let fiche: GenFicheOutput | null = null;
  try {
    const res = await ctx.ai.generate({
      userId: job.user_id,
      purpose: "generate_fiche",
      schema: GenFicheOutput,
      system: prompt.system,
      user: prompt.user,
      maxTokens: 7000,
      temperature: 0.3,
      reasoning: "off",
      check: ficheCheck,
      cacheKey: `fiche:${GEN_VERSION}:${n.content_hash}:${p.ficheRetry ?? 0}`,
      mock: () => mockFiche(input),
    });
    fiche = res.data;
  } catch (err) {
    if (!(err instanceof AiError) || err.code !== "schema") throw err;
    log("warn", "fiche_schema_rejected", { notion: n.id });
  }
  const docKind = (n.documents as unknown as { kind: string }).kind;
  return {
    kind: "continue",
    step: docKind === "ressource" ? "verify" : "quiz",
    payload: { fiche: fiche as Json },
    progress: 1,
    total: 4,
  };
}

async function stepQuiz(ctx: JobContext, job: JobRow): Promise<StepResult> {
  const p = job.payload as Payload;
  const n = await loadNotion(ctx, job);
  const input = toInput(n, p.feedback);
  const prompt = buildQuizPrompt(input, HAS_CODE.test(n.source_text));
  let quiz: GenQuizOutput | null = null;
  try {
    const res = await ctx.ai.generate({
      userId: job.user_id,
      purpose: "generate_quiz",
      schema: GenQuizOutput,
      system: prompt.system,
      user: prompt.user,
      maxTokens: 7000,
      temperature: 0.4,
      reasoning: "off",
      cacheKey: `quiz:${GEN_VERSION}:${n.content_hash}:${p.ficheRetry ?? 0}`,
      mock: () => mockQuiz(input),
    });
    quiz = res.data;
  } catch (err) {
    if (!(err instanceof AiError) || err.code !== "schema") throw err;
    log("warn", "quiz_schema_rejected", { notion: n.id });
  }
  return { kind: "continue", step: "verify", payload: { quiz: quiz as Json }, progress: 2, total: 4 };
}

async function stepVerify(ctx: JobContext, job: JobRow): Promise<StepResult> {
  const p = job.payload as Payload;
  const n = await loadNotion(ctx, job);
  const items = verifiableItems(p);
  // Barrière 1 : la citation doit exister mot pour mot (ou presque) dans la source.
  const { kept, rejected } = deterministicCheck(items, n.source_text);
  // Barrière 2 : relecture par un modèle léger, élément par élément.
  let llmRejected: string[] = [];
  if (kept.length) {
    const prompt = buildVerifyPrompt(kept, n.source_text);
    try {
      const { data } = await ctx.ai.generate({
        userId: job.user_id,
        purpose: "verify",
        tier: "light",
        schema: VerifyOutput,
        system: prompt.system,
        user: prompt.user,
        maxTokens: 4000,
        temperature: 0,
        mock: () => mockVerify(kept, n.source_text),
      });
      const verdicts = new Map(data.verdicts.map((v) => [v.id, v.supported]));
      // Un élément sans verdict n'est pas considéré comme vérifié.
      llmRejected = kept.filter((k) => verdicts.get(k.id) !== true).map((k) => k.id);
    } catch (err) {
      if (!(err instanceof AiError) || err.code !== "schema") throw err;
      llmRejected = kept.map((k) => k.id);
    }
  }
  const allRejected = [...rejected, ...llmRejected];
  const ficheMissing = !p.fiche || allRejected.includes("fiche");
  if (ficheMissing && (p.ficheRetry ?? 0) < 1) {
    // Une seule nouvelle tentative, avec une consigne de fidélité renforcée.
    return {
      kind: "continue",
      step: "fiche",
      payload: {
        ficheRetry: (p.ficheRetry ?? 0) + 1,
        fiche: null,
        quiz: null,
        feedback:
          "La version précédente contenait des éléments absents du texte. Reste strictement fidèle au texte et cite-le mot pour mot.",
      },
      progress: 0,
      total: 4,
    };
  }
  return { kind: "continue", step: "save", payload: { rejected: allRejected }, progress: 3, total: 4 };
}

async function stepSave(ctx: JobContext, job: JobRow): Promise<StepResult> {
  const p = job.payload as Payload;
  const n = await loadNotion(ctx, job);
  const rejected = new Set(p.rejected ?? []);
  const allowedPages = new Set(n.pages);
  const pagesOf = (sp: number[]) => {
    const ok = sp.filter((x) => allowedPages.has(x));
    return ok.length ? ok : [n.pages[0]!];
  };
  const base = {
    user_id: job.user_id,
    notion_id: n.id,
    subject_id: n.subject_id,
    document_id: n.document_id,
    verified: true,
    gen_hash: n.content_hash,
  };
  const rows: Array<
    typeof base & { type: string; content: Json; source_pages: number[]; source_quote: string; position: number }
  > = [];
  let pos = 0;
  if (p.fiche) {
    const { sourceQuote, sourcePages, ...fiche } = p.fiche.fiche;
    if (!rejected.has("fiche"))
      rows.push({
        ...base,
        type: "fiche",
        content: fiche,
        source_pages: pagesOf(sourcePages),
        source_quote: sourceQuote,
        position: pos++,
      });
    p.fiche.flashcards.forEach((c, i) => {
      const { sourceQuote, sourcePages, ...content } = c;
      if (!rejected.has(`f${i}`))
        rows.push({
          ...base,
          type: "flashcard",
          content,
          source_pages: pagesOf(sourcePages),
          source_quote: sourceQuote,
          position: pos++,
        });
    });
    p.fiche.vocab.forEach((c, i) => {
      const { sourceQuote, sourcePages, ...content } = c;
      if (!rejected.has(`v${i}`))
        rows.push({
          ...base,
          type: "vocab",
          content,
          source_pages: pagesOf(sourcePages),
          source_quote: sourceQuote,
          position: pos++,
        });
    });
    p.fiche.phrases.forEach((c, i) => {
      const { sourceQuote, sourcePages, ...content } = c;
      if (!rejected.has(`p${i}`))
        rows.push({
          ...base,
          type: "phrase",
          content,
          source_pages: pagesOf(sourcePages),
          source_quote: sourceQuote,
          position: pos++,
        });
    });
  }
  p.quiz?.quiz.forEach((q, i) => {
    const { sourceQuote, sourcePages, type, ...content } = q;
    if (!rejected.has(`q${i}`))
      rows.push({
        ...base,
        type,
        content: content as Json,
        source_pages: pagesOf(sourcePages),
        source_quote: sourceQuote,
        position: pos++,
      });
  });

  // Les cartes modifiées à la main sont conservées ; les autres sont remplacées.
  await ctx.db.from("cards").delete().eq("notion_id", n.id).eq("edited", false).neq("status", "flagged");
  if (rows.length) {
    const { error } = await ctx.db.from("cards").insert(rows as never);
    if (error) throw error;
  }
  const hasFiche = rows.some((r) => r.type === "fiche");
  await ctx.db
    .from("notions")
    .update({
      status: rows.length ? "ready" : "error",
      error_message: rows.length
        ? hasFiche
          ? null
          : "Fiche écartée : rien de vérifiable dans la source."
        : "Aucun contenu vérifiable n'a pu être produit.",
    })
    .eq("id", n.id);
  await refreshDocumentStatus(ctx, n.document_id);
  return { kind: "done", progress: 4, total: 4 };
}

export async function refreshDocumentStatus(ctx: JobContext, documentId: string) {
  const { count } = await ctx.db
    .from("notions")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId)
    .in("status", ["pending", "generating"]);
  if ((count ?? 0) === 0) {
    await ctx.db.from("documents").update({ status: "ready" }).eq("id", documentId).eq("status", "generating");
  }
}

export const generateHandler: JobHandler = {
  async run(job, ctx) {
    switch (job.step) {
      case "start":
      case "fiche":
        return stepFiche(ctx, job);
      case "quiz":
        return stepQuiz(ctx, job);
      case "verify":
        return stepVerify(ctx, job);
      case "save":
        return stepSave(ctx, job);
      default:
        throw new JobFatal(`Étape inconnue : ${job.step}`);
    }
  },
  async onFail(job, ctx, message) {
    const { notionId } = job.payload as Payload;
    const { data } = await ctx.db
      .from("notions")
      .update({ status: "error", error_message: message })
      .eq("id", notionId)
      .eq("user_id", job.user_id)
      .select("document_id")
      .maybeSingle();
    if (data) await refreshDocumentStatus(ctx, data.document_id);
  },
};
