import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

function env() {
  const e: Record<string, string> = {};
  // Contre la prod (E2E_BASE_URL), seules les clés cloud de .env sont utilisées.
  const files = process.env.E2E_BASE_URL ? [".env"] : [".env", ".env.development.local", ".env.test.local"];
  for (const f of files) if (existsSync(f)) Object.assign(e, parse(readFileSync(f, "utf8")));
  return { ...e, ...process.env } as Record<string, string>;
}

export const E = env();

export function admin() {
  return createClient(E.NEXT_PUBLIC_SUPABASE_URL!, E.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
}

export async function makeUser(label = "e2e") {
  const email = `${label}-${randomUUID().slice(0, 8)}@test.fil.invalid`;
  const password = `Revision-${randomUUID().slice(0, 8)}-42`;
  const a = admin();
  await a.rpc("admin_allow_email", { p_email: email });
  const { data, error } = await a.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return { id: data.user!.id, email, password };
}

export async function removeUser(id: string | undefined) {
  if (id) await admin().auth.admin.deleteUser(id);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Ton e-mail").fill(email);
  await page.getByLabel("Ton mot de passe").fill(password);
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).not.toHaveURL(/connexion/);
}
