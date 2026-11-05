import { describe, expect, it } from "vitest";
import { toAnkiCsv } from "@/lib/export/anki";

describe("export Anki", () => {
  it("CSV point-virgule, BOM, guillemets et retours à la ligne échappés", () => {
    const csv = toAnkiCsv([
      { front: "Qu'est-ce qu'une \"clé\" ?", back: "Ligne 1\nLigne 2; suite", tags: ["Fil", "bases de données"] },
      { front: "Simple", back: "Réponse", tags: ["Fil"] },
    ]);
    expect(csv.startsWith("﻿#separator:semicolon")).toBe(true);
    expect(csv).toContain('"Qu\'est-ce qu\'une ""clé"" ?"');
    expect(csv).toContain('"Ligne 1<br>Ligne 2; suite"');
    expect(csv).toContain("Fil bases_de_données");
    expect(csv.trim().split("\n").at(-1)).toBe("Simple;Réponse;Fil");
  });
});
