/** Extrait le premier objet JSON d'une réponse (tolère ```json ... ``` et du texte autour). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* on cherche un bloc */
  }
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence) {
    try {
      return JSON.parse(fence[1]!.trim());
    } catch {
      /* suite */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* échec */
    }
  }
  throw new SyntaxError("Aucun JSON valide dans la réponse");
}
