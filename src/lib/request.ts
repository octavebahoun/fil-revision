import "server-only";
import { headers } from "next/headers";

/** IP du client (Vercel fournit x-forwarded-for fiable). Sert uniquement à la limitation de débit. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "";
  return fwd.split(",")[0]?.trim() || "local";
}
