import JSZip from "jszip";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PAGES = 600;

export type FileKind = "pdf" | "pptx" | "docx" | "txt" | "md";

export const MIME: Record<FileKind, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
};

export const ACCEPTED_EXTENSIONS = [".pdf", ".pptx", ".docx", ".txt", ".md"];

export class FileRejected extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "FileRejected";
  }
}

export function extensionOf(filename: string): string {
  const m = /\.[a-z0-9]+$/i.exec(filename.trim());
  return m ? m[0].toLowerCase() : "";
}

function startsWith(bytes: Uint8Array, sig: number[]) {
  return sig.every((b, i) => bytes[i] === b);
}

function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 64 * 1024));
  if (sample.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(
      sample.length < bytes.length ? sample.subarray(0, sample.length - 4) : sample,
    );
    return true;
  } catch {
    return false;
  }
}

/** Type RÉEL du fichier d'après son contenu (magic bytes), pas d'après son nom. */
export async function detectFileKind(bytes: Uint8Array, filename: string): Promise<FileKind> {
  if (bytes.length === 0) throw new FileRejected("Le fichier est vide.");
  if (bytes.length > MAX_FILE_BYTES) throw new FileRejected("Le fichier dépasse 50 Mo.");
  const ext = extensionOf(filename);

  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch {
      throw new FileRejected("Le fichier semble abîmé : impossible de l'ouvrir.");
    }
    if (zip.file("ppt/presentation.xml")) return "pptx";
    if (zip.file("word/document.xml")) return "docx";
    throw new FileRejected("Ce fichier compressé n'est ni un PowerPoint ni un Word.");
  }
  if ((ext === ".txt" || ext === ".md") && looksLikeText(bytes)) return ext === ".md" ? "md" : "txt";
  throw new FileRejected("Ce type de fichier n'est pas pris en charge. Formats acceptés : PDF, PPTX, DOCX, TXT, MD.");
}
