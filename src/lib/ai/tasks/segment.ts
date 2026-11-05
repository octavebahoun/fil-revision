import { z } from "zod";
import { comparable, normalizeSpaces, truncateWords } from "@/lib/text/normalize";
import { wordCount } from "@/lib/ingest/clean";
import { UNTRUSTED_RULES, makeBoundary, wrapUntrusted } from "../untrusted";

export const SegmentOutput = z.object({
  documentTitle: z.string().trim().max(120).optional().default(""),
  notions: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(100),
        pages: z.array(z.number().int().positive()).min(1).max(40),
      }),
    )
    .max(40),
});
export type SegmentOutput = z.infer<typeof SegmentOutput>;

export type PageText = { page: number; text: string };

/** Fenêtres de pages consécutives (< maxChars) pour rester sous 60 s par étape. */
export function segmentWindows(pages: PageText[], maxChars = 12_000, maxPages = 14): PageText[][] {
  const windows: PageText[][] = [];
  let cur: PageText[] = [];
  let size = 0;
  for (const p of pages) {
    const len = Math.min(p.text.length, maxChars);
    if (cur.length && (size + len > maxChars || cur.length >= maxPages)) {
      windows.push(cur);
      cur = [];
      size = 0;
    }
    cur.push({ page: p.page, text: p.text.slice(0, maxChars) });
    size += len;
  }
  if (cur.length) windows.push(cur);
  return windows;
}

export function buildSegmentPrompt(
  window: PageText[],
  ctx: { documentTitle: string; first: boolean; language: "fr" | "en" },
) {
  const boundary = makeBoundary();
  const body = window.map((p) => `[[PAGE ${p.page}]]\n${p.text}`).join("\n\n");
  const system = `Tu découpes un support de cours en NOTIONS pour un étudiant qui révise.
Une notion = UN concept atomique (une définition, une méthode, une règle, un outil, une étape clé…), que l'on peut expliquer en 5 lignes.
${UNTRUSTED_RULES}

CONSIGNES :
- Couvre tout le contenu pédagogique des pages fournies. Ignore les pages de titre, sommaires, remerciements, bibliographies, pages vides.
- Chaque notion a un titre court et explicite en français (3 à 9 mots), compréhensible hors contexte ; pas de numéro de chapitre.
- "pages" = les numéros [[PAGE n]] où la notion est expliquée (1 à 4 pages en général), uniquement parmi les pages fournies.
- Vise environ une notion pour 150 à 400 mots de contenu. Évite les doublons.
${ctx.first ? '- "documentTitle" : un titre court et clair pour tout le document (6 mots max).' : '- "documentTitle" : chaîne vide.'}
${ctx.language === "en" ? "- Ce cours est en anglais : titres en français, mais garde les expressions anglaises étudiées." : ""}

Format JSON exact : {"documentTitle": "...", "notions": [{"title": "...", "pages": [3, 4]}]}`;
  const user = `Document : « ${ctx.documentTitle} ».\nPages ${window[0]!.page} à ${window[window.length - 1]!.page} :\n${wrapUntrusted("cours", body, boundary)}`;
  return { system, user };
}

/** Garde-fous sur la sortie : pages dans la fenêtre, titres non vides, pas de doublon. */
export function sanitizeSegment(out: SegmentOutput, window: PageText[]): SegmentOutput["notions"] {
  const allowed = new Set(window.map((p) => p.page));
  const seen = new Set<string>();
  const res: SegmentOutput["notions"] = [];
  for (const n of out.notions) {
    // Une notion « atomique » tient sur peu de pages : au-delà de 6, on garde les premières.
    const pages = [...new Set(n.pages.filter((p) => allowed.has(p)))].sort((a, b) => a - b).slice(0, 6);
    const key = comparable(n.title);
    if (!pages.length || !key || seen.has(key)) continue;
    seen.add(key);
    res.push({ title: truncateWords(normalizeSpaces(n.title), 90), pages });
  }
  return res;
}

/** Segmentation déterministe (fournisseur simulé) : une notion par page « substantielle », titre = première ligne. */
export function mockSegment(window: PageText[], first: boolean): SegmentOutput {
  const notions: SegmentOutput["notions"] = [];
  for (const p of window) {
    if (wordCount(p.text) < 12) continue;
    const firstLine = p.text.split("\n").find((l) => /\p{L}{3,}/u.test(l)) ?? `Notion page ${p.page}`;
    const title = truncateWords(firstLine.replace(/^[\d.\s◆▶•-]+/, "").trim() || `Notion page ${p.page}`, 80);
    const prev = notions[notions.length - 1];
    if (prev && comparable(prev.title) === comparable(title) && prev.pages.length < 4) prev.pages.push(p.page);
    else notions.push({ title: title.length >= 2 ? title : `Notion page ${p.page}`, pages: [p.page] });
  }
  return { documentTitle: first ? "" : "", notions };
}

export function mergeAcrossWindows(
  prev: { title: string; pages: number[] } | undefined,
  next: SegmentOutput["notions"],
) {
  if (!prev || !next.length) return { mergedIntoPrev: false, rest: next };
  if (comparable(prev.title) === comparable(next[0]!.title)) {
    prev.pages = [...new Set([...prev.pages, ...next[0]!.pages])].sort((a, b) => a - b);
    return { mergedIntoPrev: true, rest: next.slice(1) };
  }
  return { mergedIntoPrev: false, rest: next };
}

/** Texte source d'une notion : ses pages, avec repères [p. N] pour les citations. */
export function notionSourceText(pages: number[], byPage: Map<number, string>, maxChars = 9000): string {
  const parts: string[] = [];
  let size = 0;
  for (const n of pages) {
    const t = byPage.get(n);
    if (!t) continue;
    const chunk = `[p. ${n}]\n${t}`;
    if (size + chunk.length > maxChars && parts.length) break;
    parts.push(chunk.slice(0, maxChars));
    size += chunk.length;
  }
  return parts.join("\n\n");
}
