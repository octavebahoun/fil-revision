"use server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import {
  DISPLAY_COOKIE,
  SettingsSchema,
  displayPrefs,
  parseSettings,
  serializeDisplayCookie,
  type Settings,
} from "@/lib/settings";

export async function saveSettingsAction(patch: Partial<Settings>): Promise<Settings> {
  const { user, supabase } = await requireUser();
  const partial = SettingsSchema.partial().safeParse(patch);
  if (!partial.success) throw new Error("Réglage invalide.");
  const { data: profile } = await supabase.from("profiles").select("settings").eq("user_id", user.id).single();
  const next = parseSettings({ ...(profile?.settings as object | null), ...partial.data });
  await supabase.from("profiles").update({ settings: next }).eq("user_id", user.id);
  const c = await cookies();
  c.set(DISPLAY_COOKIE, serializeDisplayCookie(displayPrefs(next)), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
  });
  return next;
}
