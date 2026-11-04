"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { allowedEmails, siteUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { log } from "@/lib/log";
import { EmailSchema, PasswordSchema, SignInSchema, SignUpSchema, safeNext } from "@/lib/auth/validation";

export type FormState = { ok: boolean; message: string; field?: string } | null;

const NEUTRAL_LOGIN_ERROR = "E-mail ou mot de passe incorrect. Si tu viens de t'inscrire, confirme d'abord ton e-mail.";
const TOO_MANY = "Beaucoup d'essais d'un coup. Fais une petite pause, puis réessaie dans quelques minutes.";

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = SignInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, message: NEUTRAL_LOGIN_ERROR };
  const ip = await clientIp();
  if (!(await rateLimit("login", ip)) || !(await rateLimit("login", parsed.data.email))) {
    return { ok: false, message: TOO_MANY };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    log("info", "login_failed", { code: error.code ?? "auth" });
    return { ok: false, message: NEUTRAL_LOGIN_ERROR };
  }
  redirect(safeNext(formData.get("suite")));
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = SignUpSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Vérifie les champs.", field: String(issue?.path[0] ?? "") };
  }
  const ip = await clientIp();
  if (!(await rateLimit("signup", ip))) return { ok: false, message: TOO_MANY };

  const neutral: FormState = {
    ok: true,
    message: "Si cette adresse est autorisée, tu vas recevoir un e-mail. Clique sur le lien pour confirmer.",
  };
  // Double barrière : la liste est vérifiée ici ET dans le hook Supabase (before_user_created).
  if (!allowedEmails().includes(parsed.data.email)) {
    log("info", "signup_refused_not_allowed");
    return neutral;
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?suite=/` },
  });
  if (error) log("warn", "signup_error", { code: error.code ?? "auth" });
  return neutral;
}

export async function requestResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  const neutral: FormState = {
    ok: true,
    message: "Si un compte existe avec cette adresse, tu vas recevoir un lien pour choisir un nouveau mot de passe.",
  };
  if (!parsed.success) return { ok: false, message: "Cette adresse e-mail ne semble pas valide.", field: "email" };
  const ip = await clientIp();
  if (!(await rateLimit("reset", ip)) || !(await rateLimit("reset", parsed.data))) return neutral;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl()}/auth/callback?suite=/nouveau-mot-de-passe`,
  });
  if (error) log("warn", "reset_error", { code: error.code ?? "auth" });
  return neutral;
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = PasswordSchema.safeParse(formData.get("password"));
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Mot de passe invalide.", field: "password" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    log("warn", "update_password_error", { code: error.code ?? "auth" });
    return { ok: false, message: "Le lien a peut-être expiré. Redemande un e-mail de réinitialisation." };
  }
  return { ok: true, message: "C'est fait. Ton nouveau mot de passe est enregistré." };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
