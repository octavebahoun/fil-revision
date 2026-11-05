import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { detectFileKind } from "@/lib/ingest/filetype";
import { extractPages } from "@/lib/ingest/extract";
import { cleanPages, wordCount } from "@/lib/ingest/clean";
import { classifyDocument, titleFromFilename } from "@/lib/ingest/classify";
import { planSubjects, type TreeEntry } from "@/lib/ingest/subjects";
import { detectLanguage } from "@/lib/text/normalize";

const ROOT = "/home/precieux/Téléchargements/IESIG";
const entries: TreeEntry[] = [];
function walk(dir: string) {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    const rel = path.relative(ROOT, p);
    if (statSync(p).isDirectory()) {
      entries.push({ path: rel, type: "dir" });
      walk(p);
    } else entries.push({ path: rel, type: "file" });
  }
}
walk(ROOT);
const plan = planSubjects(entries);
for (const s of plan) console.log(`- ${s.name} [${s.slug}] ${s.kind} files=${s.files.length}`);
let total = 0;
for (const s of plan)
  for (const f of s.files) {
    const bytes = new Uint8Array(readFileSync(path.join(ROOT, f)));
    const kind = await detectFileKind(bytes, f);
    const raw = await extractPages(bytes, kind);
    const pages = cleanPages(raw);
    const chars = pages.join("").length;
    total += chars;
    console.log(
      `\n## ${titleFromFilename(path.basename(f))} | ${kind} | pages=${pages.length} chars=${chars} words=${pages.reduce((n, p) => n + wordCount(p), 0)} lang=${detectLanguage(pages.join(" "))} class=${classifyDocument({ filename: path.basename(f), subjectKind: s.kind, pages })}`,
    );
    const sample = pages.find((p, i) => i >= 2 && p.length > 200) ?? pages[0];
    console.log((sample ?? "").slice(0, 300).replace(/\n/g, " ⏎ "));
  }
console.log("\nTOTAL chars", total);
