export type DocKind = "cours" | "exercice" | "ressource";

const EXERCISE_NAME = /(enonc[ée]|exercice|\btp\b|\btd\b|sujet|cas pratique|[ée]tude de cas|\bIWA-B\d)/i;
// « Étape 1 » seul est ambigu (les tutoriels en ont aussi) : on ne compte que les marqueurs d'énoncé.
const EXERCISE_TEXT =
  /(travail (à|a) faire|consignes?|livrables?|(à|a) rendre|vous devez|on vous demande|votre mission|il vous est demand[ée]|contexte de l'exercice|bar[èe]me)/gi;
const RESOURCE_NAME = /(guide|tuto|installation|ressource|cheat ?sheet|aide-m[ée]moire)/i;

/** Classement d'un document : cours, énoncé d'exercice ou ressource. */
export function classifyDocument(input: {
  filename: string;
  subjectKind: "matiere" | "ressources";
  pages: string[];
}): DocKind {
  if (input.subjectKind === "ressources") return "ressource";
  const name = input.filename.normalize("NFC");
  if (EXERCISE_NAME.test(name)) return "exercice";
  const text = input.pages.join("\n");
  const markers = text.match(EXERCISE_TEXT)?.length ?? 0;
  if (markers >= 4 && input.pages.length <= 15) return "exercice";
  if (RESOURCE_NAME.test(name)) return "ressource";
  return "cours";
}

/** Titre lisible depuis un nom de fichier : « initiation_aux_x.pptx - Google Slides.pdf » → « Initiation aux x ». */
export function titleFromFilename(filename: string): string {
  let t = filename.normalize("NFC").replace(/\.[a-z0-9]{2,4}$/i, "");
  t = t.replace(/[\s\u00a0\u202f]*[-–—][\s\u00a0\u202f]*Google[\s\u00a0]+(Slides|Docs)[\s\u00a0]*$/i, "");
  t = t.replace(/\.(pptx?|docx?|pdf)$/i, "");
  t = t.replace(/\s+_\s+|_\s+|\s+_/g, " – ");
  t = t.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/\s+–\s+IESIG$/i, "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Document";
}
