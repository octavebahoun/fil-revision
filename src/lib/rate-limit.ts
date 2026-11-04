import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

export const LIMITS = {
  login: { max: 8, windowSeconds: 300 },
  signup: { max: 5, windowSeconds: 3600 },
  reset: { max: 4, windowSeconds: 3600 },
  ai: { max: 30, windowSeconds: 60 },
  aiHeavy: { max: 10, windowSeconds: 600 },
  upload: { max: 40, windowSeconds: 600 },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Renvoie true si l'action est autorisée. Compteur partagé en base (fonctionne en serverless). */
export async function rateLimit(name: LimitName, subject: string): Promise<boolean> {
  if (env().RATE_LIMIT_DISABLED === "1") return true;
  const { max, windowSeconds } = LIMITS[name];
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    p_key: `${name}:${subject}`,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // En cas de panne du compteur, on refuse les actions coûteuses (IA) et on laisse passer le reste.
    log("error", "rate_limit_failed", { name, code: error.code });
    return !name.startsWith("ai");
  }
  return data === true;
}
