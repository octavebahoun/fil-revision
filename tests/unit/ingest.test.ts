import { describe, expect, it } from "vitest";
import { detectFileKind, FileRejected } from "@/lib/ingest/filetype";
import { extractPages, paginate, withTimeout, ExtractTimeout } from "@/lib/ingest/extract";
import { cleanPages, wordCount } from "@/lib/ingest/clean";
import { classifyDocument, titleFromFilename } from "@/lib/ingest/classify";
import { normalizeName, planSubjects } from "@/lib/ingest/subjects";
import { makeDocx, makePdf, makePptx, COURSE_PAGES } from "../helpers/fixtures";
import JSZip from "jszip";

describe("type réel des fichiers (magic bytes)", () => {
  it("reconnaît PDF, PPTX, DOCX, TXT, MD", async () => {
    expect(await detectFileKind(makePdf([["Bonjour"]]), "x.pdf")).toBe("pdf");
    expect(await detectFileKind(await makePptx([["Diapo"]]), "x.pptx")).toBe("pptx");
    expect(await detectFileKind(await makeDocx(["Texte"]), "x.docx")).toBe("docx");
    expect(await detectFileKind(new TextEncoder().encode("# Titre\nTexte"), "x.md")).toBe("md");
    expect(await detectFileKind(new TextEncoder().encode("Texte simple"), "x.txt")).toBe("txt");
  });
  it("ignore l'extension : un PDF renommé .docx reste un PDF", async () => {
    expect(await detectFileKind(makePdf([["x"]]), "piege.docx")).toBe("pdf");
  });
  it("refuse un exécutable déguisé, un fichier vide, un ZIP quelconque, un binaire en .txt", async () => {
    await expect(detectFileKind(new Uint8Array([0x4d, 0x5a, 0x90, 0]), "cours.pdf")).rejects.toBeInstanceOf(
      FileRejected,
    );
    await expect(detectFileKind(new Uint8Array(), "vide.pdf")).rejects.toThrow("vide");
    const zip = new JSZip();
    zip.file("a.txt", "x");
    await expect(detectFileKind(await zip.generateAsync({ type: "uint8array" }), "a.pptx")).rejects.toThrow(
      /ni un PowerPoint/,
    );
    await expect(detectFileKind(new Uint8Array([0x41, 0, 0x42]), "a.txt")).rejects.toBeInstanceOf(FileRejected);
  });
  it("refuse un fichier de plus de 50 Mo", async () => {
    await expect(detectFileKind(new Uint8Array(50 * 1024 * 1024 + 1), "gros.pdf")).rejects.toThrow("50 Mo");
  });
  it("refuse un ZIP abîmé", async () => {
    await expect(detectFileKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), "a.pptx")).rejects.toThrow(/abîmé/);
  });
});

describe("extraction par page / diapo", () => {
  it("PDF : une entrée par page, accents conservés", async () => {
    const pages = await extractPages(makePdf(COURSE_PAGES), "pdf");
    expect(pages).toHaveLength(4);
    expect(pages[1]).toContain("clé primaire");
  });
  it("PDF abîmé : erreur claire, pas de crash", async () => {
    await expect(extractPages(new TextEncoder().encode("%PDF-1.4 n'importe quoi"), "pdf")).rejects.toThrow(
      /abîmé|protégé/,
    );
  });
  it("PPTX : une entrée par diapo, dans l'ordre", async () => {
    const pages = await extractPages(await makePptx([["Un"], ["Deux", "suite"], ["Trois"]]), "pptx");
    expect(pages).toEqual(["Un", "Deux\nsuite", "Trois"]);
  });
  it("DOCX : texte découpé en pages", async () => {
    const pages = await extractPages(await makeDocx(["Premier paragraphe.", "Second paragraphe."]), "docx");
    expect(pages.join(" ")).toContain("Second paragraphe");
  });
  it("pagination aux limites de paragraphes et titres markdown", () => {
    const text = Array.from({ length: 10 }, (_, i) => `## Partie ${i}\n${"mot ".repeat(200)}`).join("\n\n");
    const pages = paginate(text, 1500);
    expect(pages.length).toBeGreaterThan(3);
    expect(pages.every((p) => p.length <= 2500)).toBe(true);
  });
  it("délai maximal de lecture", async () => {
    await expect(withTimeout(new Promise(() => {}), 20)).rejects.toBeInstanceOf(ExtractTimeout);
  });
});

describe("nettoyage", () => {
  it("retire en-têtes, pieds de page, numéros et sommaires", () => {
    const pages = Array.from({ length: 6 }, (_, i) =>
      [
        "Université Exemple — Cours de BDD",
        "Navigation : Partie A",
        `Contenu unique de la page ${i} sur les jointures.`,
        "1.2 Les jointures . . . . . . . . 14",
        `${i + 1} / 6`,
      ].join("\n"),
    );
    const cleaned = cleanPages(pages);
    for (const [i, p] of cleaned.entries()) {
      expect(p).toContain(`Contenu unique de la page ${i}`);
      expect(p).not.toContain("Université Exemple");
      expect(p).not.toContain("/ 6");
      expect(p).not.toContain(". . . .");
    }
  });
  it("recolle les mots coupés en fin de ligne", () => {
    expect(cleanPages(["une infor-\nmation importante"])[0]).toContain("information");
  });
  it("compte les mots", () => {
    expect(wordCount("Une clé, 12 lignes !")).toBe(3);
  });
});

describe("classement des documents", () => {
  it("énoncé d'exercice par le nom", () => {
    expect(
      classifyDocument({ filename: "IWA-B3-M2_ Initiation _ IESIG.pdf", subjectKind: "matiere", pages: ["x"] }),
    ).toBe("exercice");
  });
  it("énoncé d'exercice par le contenu", () => {
    const pages = [
      "Contexte de l'exercice : une agence. Travail à faire : 1. Consignes. Livrables à rendre. Vous devez…",
    ];
    expect(classifyDocument({ filename: "semaine3.pdf", subjectKind: "matiere", pages })).toBe("exercice");
  });
  it("un tutoriel avec des étapes reste un cours", () => {
    const pages = ["Étape 1 — Créer la base", "Étape 2 — Importer", "Étape 3 — Tester", "Étape 4 — Publier"];
    expect(classifyDocument({ filename: "hebergement.pdf", subjectKind: "matiere", pages })).toBe("cours");
  });
  it("ressource : dossier Ressources ou guide", () => {
    expect(classifyDocument({ filename: "a.pdf", subjectKind: "ressources", pages: [] })).toBe("ressource");
    expect(classifyDocument({ filename: "guideJupyter.pdf", subjectKind: "matiere", pages: [] })).toBe("ressource");
  });
  it("titres lisibles", () => {
    expect(titleFromFilename("initiation_aux_fondamentaux_du_projet_web.pptx - Google Slides.pdf")).toBe(
      "Initiation aux fondamentaux du projet web",
    );
    expect(titleFromFilename("hébergement avec php et base de donnée mysql.pptx.pdf")).toBe(
      "Hébergement avec php et base de donnée mysql",
    );
    expect(titleFromFilename("IWA-B3-M2_ Initiation aux fondamentaux du projet web _ IESIG.pdf")).toBe(
      "IWA-B3-M2 – Initiation aux fondamentaux du projet web",
    );
  });
});

describe("arborescence → matières", () => {
  const entries = [
    { path: "00 – Forum & Annonces Générales", type: "dir" as const },
    { path: "00 – Ressources Étudiants", type: "dir" as const },
    { path: "00 – Ressources Étudiants/charte.pdf", type: "file" as const },
    { path: "Analyse des besoins\net modélisation UML", type: "dir" as const },
    { path: "Analyse des besoins\net modélisation UML/diapos.pdf", type: "file" as const },
    { path: "Conteneurs, CI", type: "dir" as const },
    { path: "Conteneurs, CI/CD et gestion des versions", type: "dir" as const },
    { path: "PHP et MySQL", type: "dir" as const },
    { path: "PHP et MySQL/cours.pptx.pdf", type: "file" as const },
    { path: "PHP et MySQL/notes.xyz", type: "file" as const },
    { path: ".cache", type: "dir" as const },
  ];
  const plan = planSubjects(entries);
  const names = plan.map((s) => s.name);
  it("normalise le retour à la ligne dans un nom", () => {
    expect(names).toContain("Analyse des besoins et modélisation UML");
    expect(normalizeName("A\n  b")).toBe("A b");
  });
  it("recolle le dossier coupé par « / »", () => {
    expect(names).toContain("Conteneurs, CI/CD et gestion des versions");
    expect(names).not.toContain("Conteneurs, CI");
  });
  it("les dossiers 00 – vides sont ignorés, les autres vont dans Ressources", () => {
    expect(names.some((n) => n.startsWith("00"))).toBe(false);
    const res = plan.find((s) => s.name === "Ressources");
    expect(res?.kind).toBe("ressources");
    expect(res?.files).toHaveLength(1);
  });
  it("garde les matières vides (à venir) et ignore les extensions non prises en charge", () => {
    expect(plan.find((s) => s.name.startsWith("Conteneurs"))?.files).toEqual([]);
    expect(plan.find((s) => s.name === "PHP et MySQL")?.files).toEqual(["PHP et MySQL/cours.pptx.pdf"]);
  });
});

describe("import : projets de code ignorés", () => {
  it("garde les PDF, ignore venv, node_modules, LICENSE, README et les .txt d'un projet", () => {
    const entries = [
      { path: "UML", type: "dir" as const },
      { path: "UML/diapos.pdf", type: "file" as const },
      { path: "UML/notes.md", type: "file" as const },
      { path: "UML/projet/manage.py", type: "file" as const },
      { path: "UML/projet/templates/password_reset_subject.txt", type: "file" as const },
      { path: "UML/projet/enonce.pdf", type: "file" as const },
      { path: "UML/projet/venv/lib/site-packages/django/LICENSE.txt", type: "file" as const },
      { path: "UML/projet/node_modules/x/README.md", type: "file" as const },
      { path: "UML/LICENSE.txt", type: "file" as const },
      { path: "UML/.cache/a.pdf", type: "file" as const },
    ];
    const files = planSubjects(entries)
      .find((s) => s.name === "UML")!
      .files.sort();
    expect(files).toEqual(["UML/diapos.pdf", "UML/notes.md", "UML/projet/enonce.pdf"]);
  });
});
