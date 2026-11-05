import { slugify } from "@/lib/text/normalize";
import { ACCEPTED_EXTENSIONS, extensionOf } from "./filetype";

export type TreeEntry = { path: string; type: "file" | "dir" };
export type PlannedSubject = {
  name: string;
  slug: string;
  kind: "matiere" | "ressources";
  files: string[];
};

/** Normalise les espaces (y compris un retour à la ligne glissé dans un nom de dossier). */
export function normalizeName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim();
}

const RESOURCE_PREFIX = /^0+\s*[–—-]\s*/;

/** Dossiers jamais parcourus : dépendances, environnements, caches, builds. */
export const IGNORED_DIRS =
  /^(node_modules|\.git|\.svn|venv|\.venv|env|\.env|site-packages|dist-packages|__pycache__|vendor|dist|build|\.next|\.idea|\.vscode|\.cache|.+\.egg-info|.+\.dist-info)$/i;
/** Fichiers qui signalent un projet de code : à l'intérieur, les .txt/.md ne sont pas des cours. */
const PROJECT_MARKERS =
  /^(manage\.py|package\.json|pyproject\.toml|setup\.py|setup\.cfg|requirements\.txt|composer\.json|cargo\.toml|go\.mod|pom\.xml|gemfile)$/i;
/** Noms de fichiers de projet, jamais des cours. */
const PROJECT_FILES =
  /^(readme|license|licence|copying|authors|contributors|changelog|history|notice|contributing|code_of_conduct|security|requirements|top_level|entry_points|dependency_links|sources|installer|vendor)([-_.][\w.-]*)?\.(txt|md)$/i;

/** Un fichier est-il un support de cours candidat ? (exclut dépendances, projets de code, fichiers cachés) */
export function isCourseFile(path: string, projectRoots: Set<string>): boolean {
  const parts = path.split("/").filter(Boolean);
  if (parts.some((p) => p.startsWith(".") || IGNORED_DIRS.test(p))) return false;
  const ext = extensionOf(path);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) return false;
  if (ext === ".txt" || ext === ".md") {
    if (PROJECT_FILES.test(parts.at(-1)!)) return false;
    // Dans un projet de code, seuls les PDF / PPTX / DOCX comptent comme cours.
    for (let i = 1; i < parts.length; i++) if (projectRoots.has(parts.slice(0, i).join("/"))) return false;
  }
  return true;
}

/**
 * Transforme l'arborescence des cours en matières.
 * - un dossier de premier niveau = une matière (même vide : c'est une matière à venir) ;
 * - un dossier coupé par un « / » (dossier sans fichier, avec un unique sous-dossier) est recollé ;
 * - les dossiers « 00 – … » ne sont pas des matières : ignorés s'ils sont vides, sinon rangés dans « Ressources ».
 */
export function planSubjects(entries: TreeEntry[]): PlannedSubject[] {
  const projectRoots = new Set(
    entries
      .filter((e) => e.type === "file" && PROJECT_MARKERS.test(e.path.split("/").at(-1) ?? ""))
      .map((e) => e.path.split("/").slice(0, -1).join("/")),
  );
  const top = new Map<string, { dirs: Set<string>; files: string[] }>();
  for (const e of entries) {
    const parts = e.path.split("/").filter(Boolean);
    if (parts.length === 0 || parts.some((p) => p.startsWith("."))) continue;
    const root = parts[0]!;
    if (!top.has(root)) top.set(root, { dirs: new Set(), files: [] });
    const node = top.get(root)!;
    if (e.type === "dir" && parts.length === 2) node.dirs.add(parts[1]!);
    if (e.type === "file" && parts.length >= 2 && isCourseFile(e.path, projectRoots)) node.files.push(e.path);
    if (e.type === "file" && parts.length >= 3) node.dirs.add(parts[1]!);
  }

  const subjects = new Map<string, PlannedSubject>();
  const add = (name: string, kind: PlannedSubject["kind"], files: string[]) => {
    const slug = slugify(name);
    const existing = subjects.get(slug);
    if (existing) existing.files.push(...files);
    else subjects.set(slug, { name, slug, kind, files: [...files] });
  };

  for (const [root, node] of top) {
    let name = normalizeName(root);
    const directFiles = node.files.filter((f) => f.split("/").filter(Boolean).length === 2);
    if (RESOURCE_PREFIX.test(name)) {
      if (node.files.length > 0) add("Ressources", "ressources", node.files);
      continue;
    }
    if (directFiles.length === 0 && node.dirs.size === 1) {
      // « Conteneurs, CI » + « CD et gestion des versions » → « Conteneurs, CI/CD et gestion des versions »
      name = `${name}/${normalizeName([...node.dirs][0]!)}`;
    }
    add(name, "matiere", node.files);
  }
  return [...subjects.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
