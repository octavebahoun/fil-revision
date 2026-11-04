/**
 * pnpm audit:photo — parcourt les CSS (sources + build) et le code TSX.
 * Code de sortie 1 si une violation est trouvée.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { auditCss, auditSource, collectCustomProps, type Violation } from "../src/lib/audit/photosensitive";

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

// Fichiers audités : nos CSS + le CSS réellement livré (build). Les CSS des dépendances
// ne servent qu'à résoudre les variables : une animation définie mais jamais utilisée n'est pas livrée.
const cssFiles = [...walk("src", [".css"]), ...walk(".next/static", [".css"])];
const libCss = ["node_modules/tw-animate-css/dist/tw-animate.css", "node_modules/shadcn/dist/tailwind.css"].filter(
  (f) => existsSync(f),
);

// Les variables globales (durées, --animate-*) sont partagées entre fichiers.
const globalProps = new Map<string, string>();
for (const f of [...cssFiles, ...libCss])
  for (const [k, v] of collectCustomProps(readFileSync(f, "utf8"))) if (!globalProps.has(k)) globalProps.set(k, v);

const violations: Violation[] = [];
for (const f of cssFiles) violations.push(...auditCss(f, readFileSync(f, "utf8"), globalProps));
for (const f of walk("src", [".tsx", ".ts"])) {
  if (f.includes("audit/photosensitive")) continue;
  violations.push(...auditSource(f, readFileSync(f, "utf8")));
}

if (violations.length) {
  console.error(`Audit photosensible : ${violations.length} problème(s)`);
  for (const v of violations) console.error(` - [${v.rule}] ${v.file} : ${v.detail}`);
  process.exit(1);
}
console.log(`Audit photosensible OK (${cssFiles.length} fichiers CSS analysés).`);
