import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Comparaison en temps constant d'un jeton « Bearer » avec l'un des secrets attendus. */
export function bearerMatches(header: string | null, ...secrets: (string | undefined)[]): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  return secrets.some((s) => {
    if (!s || s.length < 16) return false;
    const expected = Buffer.from(s);
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}
