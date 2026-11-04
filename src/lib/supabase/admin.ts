import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

let admin: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Client avec la clé secrète : contourne la RLS.
 * À utiliser uniquement côté serveur, pour le worker de jobs, la limitation de débit
 * et l'administration. Toute requête doit filtrer explicitement par user_id.
 */
export function createAdminClient() {
  if (admin) return admin;
  const e = env();
  admin = createClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export type AdminSupabase = ReturnType<typeof createAdminClient>;
