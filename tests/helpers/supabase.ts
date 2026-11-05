import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "@/lib/database.types";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const SECRET = process.env.SUPABASE_SECRET_KEY!;

const isLocal = SUPABASE_URL?.includes("127.0.0.1") || SUPABASE_URL?.includes("localhost");
if (!isLocal && process.env.TEST_TARGET !== "prod") {
  throw new Error("Les tests d'intégration tournent uniquement contre Supabase local.");
}

export function adminClient() {
  return createClient<Database>(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type TestUser = { id: string; email: string; password: string; client: SupabaseClient<Database> };

/** Crée un utilisateur de test confirmé et renvoie un client connecté (RLS active). */
export async function createTestUser(label = "u"): Promise<TestUser> {
  const admin = adminClient();
  const email = `${label}-${randomUUID().slice(0, 8)}@test.fil.invalid`;
  const password = `Test-${randomUUID()}-1a`;
  await admin.rpc("admin_allow_email", { p_email: email });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const client = createClient<Database>(SUPABASE_URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn: ${e2.message}`);
  return { id: data.user.id, email, password, client };
}

export async function deleteTestUser(u: TestUser | undefined) {
  if (!u) return;
  await adminClient().auth.admin.deleteUser(u.id);
}
