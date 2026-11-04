import { z } from "zod";

/** Réglages de confort et d'organisation. Stockés dans profiles.settings et en cookie (affichage). */
export const SettingsSchema = z.object({
  theme: z.enum(["system", "light", "dark", "contrast"]).default("system"),
  font: z.enum(["atkinson", "dyslexic"]).default("atkinson"),
  fontScale: z.number().min(0.9).max(1.6).default(1),
  lineHeight: z.number().min(1.4).max(2.2).default(1.65),
  motion: z.enum(["normal", "reduced", "none"]).default("normal"),
  readingRuler: z.boolean().default(false),
  ttsRate: z.number().min(0.6).max(1.6).default(1),
  sessionMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(25)]).default(10),
  dailyCapMinutes: z.number().int().min(10).max(180).default(30),
  examTimerDefault: z.boolean().default(false),
  reminder: z
    .object({
      enabled: z.boolean().default(false),
      time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .default("18:30"),
    })
    .default({ enabled: false, time: "18:30" }),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

export function parseSettings(raw: unknown): Settings {
  const r = SettingsSchema.safeParse(raw ?? {});
  if (r.success) return r.data;
  // Valeurs invalides : on garde ce qui est valide, champ par champ.
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      const field = SettingsSchema.shape[k as keyof Settings];
      if (field && field.safeParse(v).success) out[k] = v;
    }
  }
  return SettingsSchema.parse(out);
}

/** Sous-ensemble utile au rendu serveur (cookie fil_prefs). */
export const DISPLAY_COOKIE = "fil_prefs";
export type DisplayPrefs = Pick<Settings, "theme" | "font" | "fontScale" | "lineHeight" | "motion">;

export function displayPrefs(s: Settings): DisplayPrefs {
  return { theme: s.theme, font: s.font, fontScale: s.fontScale, lineHeight: s.lineHeight, motion: s.motion };
}

export function parseDisplayCookie(value: string | undefined): DisplayPrefs {
  if (!value) return displayPrefs(DEFAULT_SETTINGS);
  try {
    return displayPrefs(parseSettings(JSON.parse(decodeURIComponent(value))));
  } catch {
    return displayPrefs(DEFAULT_SETTINGS);
  }
}

export function serializeDisplayCookie(p: DisplayPrefs): string {
  return encodeURIComponent(JSON.stringify(p));
}
