/** Comparaisons tolérantes des sorties d'exercices (fonctions pures). */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}

export function outputsMatch(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

export type SqlResult = { columns: string[]; rows: unknown[][] };

/** Deux résultats SQL sont égaux (ordre des lignes ignoré si la solution ne trie pas). */
export function sqlResultsMatch(actual: SqlResult, expected: SqlResult, ordered: boolean): boolean {
  if (actual.columns.length !== expected.columns.length) return false;
  const key = (r: unknown[]) => JSON.stringify(r.map((v) => (typeof v === "number" ? Number(v.toFixed(6)) : v)));
  const a = actual.rows.map(key);
  const e = expected.rows.map(key);
  if (a.length !== e.length) return false;
  if (!ordered) {
    a.sort();
    e.sort();
  }
  return a.every((v, i) => v === e[i]);
}

export function hasOrderBy(sql: string): boolean {
  return /\border\s+by\b/i.test(sql);
}

/** Empêche le code de l'étudiant de fermer la balise de script qui l'entoure. */
export function escapeForScript(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
}
