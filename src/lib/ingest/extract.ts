import JSZip from "jszip";
import { FileRejected, MAX_PAGES, type FileKind } from "./filetype";

export class ExtractTimeout extends Error {
  constructor() {
    super("Le fichier met trop de temps à être lu.");
    this.name = "ExtractTimeout";
  }
}

export async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        t = setTimeout(() => reject(new ExtractTimeout()), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

type PdfTextItem = { str: string; hasEOL?: boolean; transform?: number[] };

async function extractPdf(bytes: Uint8Array): Promise<string[]> {
  const { getDocumentProxy } = await import("unpdf");
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch {
    throw new FileRejected("Ce PDF semble abîmé ou protégé : impossible de le lire.");
  }
  if (pdf.numPages > MAX_PAGES)
    throw new FileRejected(`Ce PDF a trop de pages (${pdf.numPages}, maximum ${MAX_PAGES}).`);
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let out = "";
    let lastY: number | null = null;
    for (const raw of content.items as PdfTextItem[]) {
      if (typeof raw.str !== "string") continue;
      const y = raw.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith("\n")) out += "\n";
      else if (out && !out.endsWith("\n") && !out.endsWith(" ") && raw.str && !raw.str.startsWith(" ")) out += " ";
      out += raw.str;
      if (raw.hasEOL) out += "\n";
      if (y !== null) lastY = y;
    }
    pages.push(out);
    page.cleanup();
  }
  await pdf.cleanup?.();
  return pages;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

async function extractPptx(bytes: Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(bytes);
  const slides = Object.keys(zip.files)
    .map((name) => ({ name, n: Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(name)?.[1]) }))
    .filter((s) => Number.isFinite(s.n) && s.n > 0)
    .sort((a, b) => a.n - b.n);
  if (slides.length > MAX_PAGES) throw new FileRejected(`Trop de diapositives (${slides.length}).`);
  const pages: string[] = [];
  for (const s of slides) {
    const xml = await zip.file(s.name)!.async("string");
    const paragraphs = xml
      .split(/<\/a:p>/)
      .map((p) => [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1]!)).join(""));
    pages.push(paragraphs.filter((p) => p.trim()).join("\n"));
  }
  return pages;
}

/** Découpe un texte continu en « pages » d'environ `size` caractères, aux limites de paragraphes. */
export function paginate(text: string, size = 2500): string[] {
  const paras = text.split(/\n{2,}|\n(?=#{1,6} )/);
  const pages: string[] = [];
  let cur = "";
  for (const p of paras) {
    const isHeading = /^#{1,3} /.test(p.trim());
    if (cur && (cur.length + p.length > size || (isHeading && cur.length > size * 0.4))) {
      pages.push(cur.trim());
      cur = "";
    }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur.trim()) pages.push(cur.trim());
  return pages.length ? pages : [""];
}

async function extractDocx(bytes: Uint8Array): Promise<string[]> {
  const mammoth = await import("mammoth");
  try {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return paginate(value);
  } catch {
    throw new FileRejected("Ce document Word semble abîmé : impossible de le lire.");
  }
}

export async function extractPages(bytes: Uint8Array, kind: FileKind, timeoutMs = 45_000): Promise<string[]> {
  const run = async () => {
    switch (kind) {
      case "pdf":
        return extractPdf(bytes);
      case "pptx":
        return extractPptx(bytes);
      case "docx":
        return extractDocx(bytes);
      case "txt":
      case "md":
        return paginate(new TextDecoder("utf-8").decode(bytes));
    }
  };
  const pages = await withTimeout(run(), timeoutMs);
  if (pages.length > MAX_PAGES) throw new FileRejected(`Trop de pages (${pages.length}, maximum ${MAX_PAGES}).`);
  return pages;
}
