import { describe, expect, it } from "vitest";
import { escapeForScript, hasOrderBy, normalizeOutput, outputsMatch, sqlResultsMatch } from "@/lib/code/compare";
import { pickLanguage, mockCode } from "@/lib/ai/tasks/code";
import { CodeExerciseOutput } from "@/lib/ai/tasks/code";

describe("exercices de code", () => {
  it("sorties : espaces de fin et retours chariot ignorés", () => {
    expect(normalizeOutput("42  \r\nfin\n")).toBe("42\nfin");
    expect(outputsMatch("42\n", "42")).toBe(true);
    expect(outputsMatch("41", "42")).toBe(false);
  });
  it("résultats SQL : ordre ignoré sauf ORDER BY", () => {
    const a = { columns: ["nom"], rows: [["Bob"], ["Alice"]] };
    const b = { columns: ["nom"], rows: [["Alice"], ["Bob"]] };
    expect(sqlResultsMatch(a, b, false)).toBe(true);
    expect(sqlResultsMatch(a, b, true)).toBe(false);
    expect(sqlResultsMatch(a, { columns: ["nom", "x"], rows: [] }, false)).toBe(false);
    expect(hasOrderBy("select * from t order  by nom")).toBe(true);
  });
  it("le code ne peut pas fermer la balise script", () => {
    expect(escapeForScript("x</script><script>alert(1)")).not.toMatch(/<\/script>/i);
  });
  it("choix du langage selon la matière et le cours", () => {
    expect(pickLanguage("PHP et MySQL", "<?php echo 'x';")).toBe("php");
    expect(pickLanguage("Modélisation avancée et persistance des données", "SELECT nom FROM t")).toBe("sql");
    expect(pickLanguage("Front-end moderne, TypeScript", "interface User { name: string }")).toBe("ts");
    expect(pickLanguage("React et Écosystème", "const App = () => <div/>")).toBe("js");
    expect(pickLanguage("Anglais", "Good morning")).toBeNull();
  });
  it("sorties simulées conformes au schéma pour chaque langage", () => {
    for (const language of ["sql", "php", "js", "ts"] as const) {
      expect(
        CodeExerciseOutput.safeParse(
          mockCode({ title: "T", sourceText: "[p. 1]\nUne requête SELECT lit les données d'une table.", language }),
        ).success,
      ).toBe(true);
    }
  });
});
