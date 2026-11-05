import { z } from "zod";
import { truncateWords } from "@/lib/text/normalize";
import { UNTRUSTED_RULES, makeBoundary, wrapUntrusted } from "../untrusted";
import { STYLE_RULES } from "./style";
import { sourceSentences } from "./generate";

export type TutorMode = "ask" | "simpler" | "example" | "quiz";
export type TutorSource = { ref: number; title: string; pages: number[]; text: string };

export const TutorOutput = z.object({
  reply: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.slice(0, 700)),
  check: z.preprocess(
    (v) => (typeof v === "string" && v.includes("?") ? v.slice(0, v.indexOf("?") + 1).trim() : v),
    z.string().trim().max(200),
  ),
  citations: z
    .array(z.object({ ref: z.coerce.number().int().min(1), page: z.coerce.number().int().min(1) }))
    .max(6)
    .default([]),
  found: z.boolean().default(true),
});
export type TutorOutput = z.infer<typeof TutorOutput>;

const MODE_RULE: Record<TutorMode, string> = {
  ask: "Réponds à la question de l'étudiant.",
  simpler:
    "L'étudiant n'a pas compris : réexplique ENCORE PLUS SIMPLEMENT, avec des mots de tous les jours, sans jargon.",
  example: "Donne UN AUTRE exemple tiré des sources (différent du précédent).",
  quiz: 'Interroge l\'étudiant : pose UNE question courte sur la notion (dans "check"), sans donner la réponse. "reply" annonce simplement la question.',
};

export function buildTutorPrompt(input: {
  mode: TutorMode;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  sources: TutorSource[];
}) {
  const boundary = makeBoundary();
  const system = `Tu es « Explique-moi », le tuteur de Fil. Tu réponds UNIQUEMENT à partir des extraits de cours fournis.
${UNTRUSTED_RULES}
${STYLE_RULES}
FORMAT DE RÉPONSE (impératif) :
- "reply" : 5 lignes au maximum (≈ 450 caractères). Une notion = une explication = un exemple.
- "check" : UNE seule question de vérification, terminée par « ? ».
- "citations" : les extraits utilisés, [{"ref": numéro de l'extrait, "page": page}].
- Si les extraits ne permettent pas de répondre : "found": false, "reply" le dit simplement et propose de reformuler. N'invente rien.
${MODE_RULE[input.mode]}
Format JSON exact : {"reply": "", "check": "", "citations": [{"ref": 1, "page": 3}], "found": true}`;
  const sources = input.sources
    .map((s) => `[Extrait ${s.ref}] « ${s.title} » (pages ${s.pages.join(", ")})\n${s.text}`)
    .join("\n\n");
  const history = input.history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "Étudiant" : "Tuteur"} : ${h.content.slice(0, 600)}`)
    .join("\n");
  const user = `${history ? `Conversation récente :\n${history}\n\n` : ""}Message de l'étudiant (donnée) : ${JSON.stringify(input.message.slice(0, 1000))}\n\n${wrapUntrusted("extraits", sources, boundary)}`;
  return { system, user };
}

/** Réponse déterministe du simulé : une phrase du premier extrait. */
export function mockTutor(input: { mode: TutorMode; sources: TutorSource[] }): TutorOutput {
  const s = input.sources[0];
  if (!s)
    return {
      reply: "Je ne trouve pas ça dans tes cours. Essaie avec d'autres mots.",
      check: "",
      citations: [],
      found: false,
    };
  const first = sourceSentences(s.text)[0];
  return {
    reply:
      input.mode === "quiz"
        ? "Petite question pour vérifier :"
        : truncateWords(`${input.mode === "simpler" ? "En plus simple : " : ""}${first?.text ?? s.title}`, 400),
    check: `Que retiens-tu de « ${truncateWords(s.title, 60)} » ?`,
    citations: [{ ref: s.ref, page: first?.page ?? s.pages[0] ?? 1 }],
    found: true,
  };
}
