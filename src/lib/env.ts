import "server-only";
import { z } from "zod";

/** Variables serveur. Les clés ne quittent jamais le serveur. */
const ServerEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SECRET_KEY: z.string().min(10),
  ALLOWED_EMAILS: z.string().default(""),
  AI_PRIMARY_PROVIDER: z.enum(["deepseek", "meta", "mock"]).default("deepseek"),
  AI_FALLBACK_PROVIDER: z.enum(["deepseek", "meta", "mock", "none"]).default("meta"),
  AI_DAILY_BUDGET_USD: z.coerce.number().positive().default(2),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-v4-pro"),
  DEEPSEEK_LIGHT_MODEL: z.string().default("deepseek-flash"),
  META_API_KEY: z.string().optional(),
  META_BASE_URL: z.url().default("https://api.meta.ai/v1"),
  META_MODEL: z.string().default("muse-spark-1.3-contributor"),
  CRON_SECRET: z.string().min(16).optional(),
  JOBS_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  RATE_LIMIT_DISABLED: z.enum(["0", "1"]).default("0"),
});

export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnv.safeParse(process.env);
  if (!parsed.success) {
    // On liste seulement les NOMS des variables en défaut, jamais leurs valeurs.
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuration incomplète : ${names}`);
  }
  cached = parsed.data;
  return cached;
}

export function allowedEmails(): string[] {
  return env()
    .ALLOWED_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export function siteUrl(): string {
  const e = env();
  if (e.NEXT_PUBLIC_SITE_URL) return e.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (e.VERCEL_PROJECT_PRODUCTION_URL) return `https://${e.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
