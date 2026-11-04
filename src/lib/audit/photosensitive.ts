/**
 * Audit photosensible (WCAG 2.3.1 / 2.3.2) des CSS et du code.
 * Échoue sur :
 *  - toute animation en boucle (infinite ou ≥ 3 itérations) de moins de 333 ms
 *    qui touche l'opacité, la couleur ou la luminosité ;
 *  - toute utilisation de `blink` ;
 *  - les utilitaires Tailwind interdits par notre politique (animate-ping, animate-bounce).
 */

export type Violation = { file: string; rule: string; detail: string };

const LUMA_PROPS =
  /\b(opacity|color|background(-color)?|filter|fill|stroke|visibility|box-shadow|border-color|outline-color)\s*:/i;

function extractBlocks(css: string, atRule: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = new RegExp(`@${atRule}\\s+([\\w-]+)\\s*\\{`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    out.set(m[1]!, css.slice(re.lastIndex, i - 1));
  }
  return out;
}

function customProps(css: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /(--[\w-]+)\s*:\s*([^;{}]+)[;}]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    // On garde la valeur la plus courte rencontrée (pire cas pour l'audit).
    const prev = map.get(m[1]!);
    if (!prev) map.set(m[1]!, m[2]!.trim());
    else {
      const a = durationMs(prev);
      const b = durationMs(m[2]!.trim());
      if (b !== null && (a === null || b < a)) map.set(m[1]!, m[2]!.trim());
    }
  }
  return map;
}

function resolveVars(value: string, props: Map<string, string>, depth = 0): string {
  if (depth > 6) return value;
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name: string, fallback?: string) => {
    const v = props.get(name) ?? fallback ?? "";
    return resolveVars(v, props, depth + 1);
  });
}

function durationMs(token: string): number | null {
  const m = /^(-?\d*\.?\d+)(ms|s)$/.exec(token.trim());
  if (!m) return null;
  return m[2] === "s" ? Number(m[1]) * 1000 : Number(m[1]);
}

type Anim = { name: string; durationMs: number | null; iterations: number };

function parseAnimationShorthand(value: string): Anim[] {
  return value.split(",").map((part) => {
    const tokens = part.trim().split(/\s+/);
    let duration: number | null = null;
    let iterations = 1;
    let name = "";
    for (const t of tokens) {
      const d = durationMs(t);
      if (d !== null) {
        if (duration === null) duration = d;
        continue;
      }
      if (t === "infinite") iterations = Infinity;
      else if (/^\d+(\.\d+)?$/.test(t)) iterations = Number(t);
      else if (
        !/^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|both|forwards|backwards|none|normal|reverse|alternate|alternate-reverse|running|paused)$/.test(
          t,
        ) &&
        !t.startsWith("cubic-bezier") &&
        !t.startsWith("steps(")
      ) {
        name = t;
      }
    }
    return { name, durationMs: duration, iterations };
  });
}

export function auditCss(file: string, css: string, extraProps?: Map<string, string>): Violation[] {
  const violations: Violation[] = [];
  const keyframes = extractBlocks(css, "keyframes");
  const props = customProps(css);
  if (extraProps) for (const [k, v] of extraProps) if (!props.has(k)) props.set(k, v);

  if (/text-decoration(-line)?\s*:\s*[^;]*\bblink\b/i.test(css)) {
    violations.push({ file, rule: "blink", detail: "text-decoration: blink" });
  }
  for (const name of keyframes.keys()) {
    if (/blink/i.test(name)) violations.push({ file, rule: "blink", detail: `@keyframes ${name}` });
  }

  const animDecl = /(?<![-\w])animation\s*:\s*([^;{}]+)/g;
  const uses: Anim[] = [];
  let m: RegExpExecArray | null;
  while ((m = animDecl.exec(css))) uses.push(...parseAnimationShorthand(resolveVars(m[1]!, props)));
  // Les variables --animate-* (Tailwind) sont aussi des animations potentielles.
  for (const [k, v] of props)
    if (k.startsWith("--animate-")) uses.push(...parseAnimationShorthand(resolveVars(v, props)));

  for (const a of uses) {
    if (!a.name || a.name === "none") continue;
    const body = keyframes.get(a.name);
    const loops = a.iterations === Infinity || a.iterations >= 3;
    if (!loops) continue;
    const touchesLuma = body ? LUMA_PROPS.test(body) : true;
    if (touchesLuma && (a.durationMs === null || a.durationMs < 333)) {
      violations.push({
        file,
        rule: "boucle-rapide",
        detail: `${a.name} : ${a.durationMs ?? "?"} ms × ${a.iterations === Infinity ? "∞" : a.iterations}`,
      });
    }
  }
  return dedupe(violations);
}

const FORBIDDEN_CLASSES = /\banimate-(ping|bounce|blink)\b/;

export function auditSource(file: string, source: string): Violation[] {
  const v: Violation[] = [];
  if (/<blink[\s>]/i.test(source)) v.push({ file, rule: "blink", detail: "<blink>" });
  const m = FORBIDDEN_CLASSES.exec(source);
  if (m) v.push({ file, rule: "classe-interdite", detail: m[0] });
  if (/text-decoration\s*:\s*["']?blink/i.test(source)) v.push({ file, rule: "blink", detail: "style blink" });
  return v;
}

function dedupe(v: Violation[]): Violation[] {
  const seen = new Set<string>();
  return v.filter((x) => {
    const k = `${x.file}|${x.rule}|${x.detail}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export { customProps as collectCustomProps };
