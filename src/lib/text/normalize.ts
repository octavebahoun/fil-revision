/** Outils de texte purs (sans dépendance), utilisés par l'ingestion et la vérification. */

export function normalizeSpaces(s: string): string {
  return s
    .replace(/[  -​  　]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Forme comparable : minuscules, sans accents ni ponctuation, espaces uniques. */
export function comparable(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "'")
    .replace(/[^a-z0-9'+#=<>()/*.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "sans-titre"
  );
}

export function sentences(text: string): string[] {
  return normalizeSpaces(text)
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function truncateWords(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const i = cut.lastIndexOf(" ");
  return (i > max * 0.6 ? cut.slice(0, i) : cut).replace(/[,;:\s]+$/, "") + "…";
}

function tokens(s: string): string[] {
  return comparable(s)
    .split(" ")
    .filter((t) => t.length > 1);
}

/**
 * La citation est-elle présente dans la source ? Correspondance exacte (après normalisation)
 * ou, à défaut, au moins `threshold` des mots de la citation présents dans une fenêtre de la source.
 */
export function quoteSupported(quote: string, source: string, threshold = 0.85): boolean {
  const q = comparable(quote).replace(/…$/, "").trim();
  if (q.length < 8) return false;
  const src = comparable(source);
  if (src.includes(q)) return true;
  const qt = tokens(quote);
  if (qt.length < 3) return false;
  const st = tokens(source);
  const win = Math.max(qt.length + 4, Math.ceil(qt.length * 1.3));
  const need = Math.ceil(qt.length * threshold);
  for (let i = 0; i + Math.min(win, st.length) <= st.length; i++) {
    const windowSet = new Set(st.slice(i, i + win));
    let hit = 0;
    for (const t of qt) if (windowSet.has(t)) hit++;
    if (hit >= need) return true;
    if (st.length <= win) break;
  }
  return false;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buf =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", buf as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Détection simple de langue (fr / en) par mots-outils. */
export function detectLanguage(text: string): "fr" | "en" {
  const words = comparable(text).split(" ").slice(0, 4000);
  const fr = new Set([
    "le",
    "la",
    "les",
    "des",
    "est",
    "et",
    "une",
    "un",
    "du",
    "dans",
    "pour",
    "que",
    "qui",
    "sur",
    "avec",
    "pas",
    "sont",
    "ce",
  ]);
  const en = new Set([
    "the",
    "is",
    "and",
    "of",
    "to",
    "in",
    "you",
    "are",
    "it",
    "that",
    "with",
    "for",
    "this",
    "your",
    "what",
    "do",
  ]);
  let f = 0;
  let e = 0;
  for (const w of words) {
    if (fr.has(w)) f++;
    if (en.has(w)) e++;
  }
  return e > f * 1.3 ? "en" : "fr";
}
