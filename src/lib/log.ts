/**
 * Logs structurés (JSON, une ligne). Jamais de contenu de cours ni de secret :
 * seuls des identifiants, compteurs et codes d'erreur sont autorisés.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

const SECRET_PATTERN = /(sb_secret_|sb_publishable_|sk-|eyJ)[A-Za-z0-9._-]{8,}/g;

function scrub(value: unknown): unknown {
  if (typeof value === "string") return value.replace(SECRET_PATTERN, "[masqué]").slice(0, 300);
  return value;
}

export function log(level: Level, event: string, fields: Fields = {}) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  if (process.env.VITEST && level !== "error") return;
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) safe[k] = scrub(v);
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function errorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err && typeof err.code === "string") return err.code;
  if (err instanceof Error) return err.name;
  return "unknown";
}
