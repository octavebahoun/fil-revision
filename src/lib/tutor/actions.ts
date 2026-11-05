"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { getAiRouter } from "@/lib/ai/server";
import { AiError } from "@/lib/ai/types";
import { TutorOutput, buildTutorPrompt, mockTutor, type TutorMode, type TutorSource } from "@/lib/ai/tasks/tutor";
import { log, errorCode } from "@/lib/log";

const Ask = z.object({
  threadId: z.uuid().nullable(),
  notionId: z.uuid().nullable(),
  message: z.string().trim().min(1).max(1000),
  mode: z.enum(["ask", "simpler", "example", "quiz"]).default("ask"),
});

export type TutorCitation = { documentId: string; title: string; page: number };
export type TutorReply =
  | { ok: true; threadId: string; reply: string; check: string; citations: TutorCitation[]; found: boolean }
  | { ok: false; message: string };

export async function askTutorAction(input: z.infer<typeof Ask>): Promise<TutorReply> {
  const { user, supabase } = await requireUser();
  const parsed = Ask.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ta question est vide ou trop longue." };
  if (!(await rateLimit("ai", user.id)))
    return { ok: false, message: "Beaucoup de questions d'un coup. Respire, et réessaie dans une minute." };
  const { notionId, message, mode } = parsed.data;
  let threadId = parsed.data.threadId;

  // Historique et contexte de la conversation.
  let history: { role: "user" | "assistant"; content: string }[] = [];
  let threadNotion = notionId;
  if (threadId) {
    const { data: t } = await supabase.from("tutor_threads").select("id, notion_id").eq("id", threadId).maybeSingle();
    if (!t) threadId = null;
    else {
      threadNotion = threadNotion ?? t.notion_id;
      const { data: msgs } = await supabase
        .from("tutor_messages")
        .select("role, content")
        .eq("thread_id", t.id)
        .order("created_at")
        .limit(20);
      history = (msgs ?? []) as typeof history;
    }
  }
  // Recherche : la notion ciblée d'abord, puis les passages les plus proches de la question.
  const query =
    mode === "ask" ? message : [message, history.filter((h) => h.role === "user").at(-1)?.content ?? ""].join(" ");
  const { data: found } = await supabase.rpc("search_course", {
    p_query: query.slice(0, 300),
    p_notion: threadNotion ?? undefined,
    p_limit: 4,
  });
  const sources: TutorSource[] = (found ?? []).map((n, i) => ({
    ref: i + 1,
    title: n.title,
    pages: n.pages,
    text: n.source_text.slice(0, 3500),
  }));

  if (!threadId) {
    const { data: t, error } = await supabase
      .from("tutor_threads")
      .insert({ user_id: user.id, notion_id: threadNotion, title: message.slice(0, 120) })
      .select("id")
      .single();
    if (error || !t) return { ok: false, message: "Impossible d'ouvrir la conversation. Réessaie." };
    threadId = t.id;
  }

  let out: TutorOutput;
  if (!sources.length) {
    out = {
      reply: "Je ne trouve pas ça dans tes cours. Essaie avec d'autres mots, ou ouvre la notion concernée.",
      check: "",
      citations: [],
      found: false,
    };
  } else {
    try {
      const prompt = buildTutorPrompt({ mode, message, history, sources });
      const res = await getAiRouter().generate({
        userId: user.id,
        purpose: "tutor",
        tier: "light",
        schema: TutorOutput,
        system: prompt.system,
        user: prompt.user,
        maxTokens: 3000,
        temperature: 0.3,
        reasoning: "off",
        mock: () => mockTutor({ mode, sources }),
      });
      out = res.data;
    } catch (err) {
      log("warn", "tutor_failed", { code: errorCode(err) });
      if (err instanceof AiError && err.code === "budget")
        return { ok: false, message: "Le budget IA du jour est atteint. Le tuteur revient demain." };
      return { ok: false, message: "Le tuteur n'a pas pu répondre. Réessaie dans un instant." };
    }
  }
  const byRef = new Map((found ?? []).map((n, i) => [i + 1, n]));
  const citations: TutorCitation[] = out.citations
    .map((c) => {
      const n = byRef.get(c.ref);
      return n
        ? { documentId: n.document_id, title: n.title, page: n.pages.includes(c.page) ? c.page : n.pages[0]! }
        : null;
    })
    .filter((c): c is TutorCitation => c !== null);
  const label: Record<TutorMode, string> = {
    ask: message,
    simpler: "Plus simple, s'il te plaît.",
    example: "Un autre exemple ?",
    quiz: "Interroge-moi.",
  };
  const assistantText = [out.reply, out.check].filter(Boolean).join("\n");
  await supabase.from("tutor_messages").insert([
    { user_id: user.id, thread_id: threadId, role: "user", content: label[mode].slice(0, 4000) },
    {
      user_id: user.id,
      thread_id: threadId,
      role: "assistant",
      content: assistantText.slice(0, 4000) || "…",
      citations,
    },
  ]);
  return { ok: true, threadId: threadId!, reply: out.reply, check: out.check, citations, found: out.found };
}
