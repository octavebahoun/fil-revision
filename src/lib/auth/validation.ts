import { z } from "zod";

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Cette adresse e-mail ne semble pas valide." }));

export const PasswordSchema = z
  .string()
  .min(10, "Au moins 10 caractères.")
  .max(128, "128 caractères au plus.")
  .regex(/[a-zA-Z]/, "Au moins une lettre.")
  .regex(/\d/, "Au moins un chiffre.");

export const SignInSchema = z.object({ email: EmailSchema, password: z.string().min(1).max(128) });
export const SignUpSchema = z.object({ email: EmailSchema, password: PasswordSchema });

/** Chemin de redirection sûr : uniquement un chemin interne. */
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
