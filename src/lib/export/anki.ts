/** Export CSV importable dans Anki (séparateur « ; », guillemets échappés, UTF-8 avec BOM). */
export type AnkiRow = { front: string; back: string; tags: string[] };

function cell(v: string): string {
  const clean = v.replace(/\r?\n/g, "<br>");
  return /[";]|<br>/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
}

export function toAnkiCsv(rows: AnkiRow[]): string {
  const header = ["#separator:semicolon", "#html:true", "#tags column:3", ""].join("\n");
  const body = rows
    .map((r) => [cell(r.front), cell(r.back), cell(r.tags.map((t) => t.replace(/\s+/g, "_")).join(" "))].join(";"))
    .join("\n");
  return `﻿${header}${body}\n`;
}
