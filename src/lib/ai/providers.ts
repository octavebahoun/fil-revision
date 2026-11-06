import { createMockProvider } from "./mock";
import { createOpenAiCompatibleProvider } from "./openai-compatible";
import { providerOrder } from "./router";
import type { LlmProvider } from "./types";

export type AiEnv = Partial<
  Record<
    | "AI_PRIMARY_PROVIDER"
    | "AI_FALLBACK_PROVIDER"
    | "DEEPSEEK_API_KEY"
    | "DEEPSEEK_BASE_URL"
    | "DEEPSEEK_MODEL"
    | "DEEPSEEK_LIGHT_MODEL"
    | "META_API_KEY"
    | "META_BASE_URL"
    | "META_MODEL",
    string
  >
>;

export type ProviderName = "meta" | "deepseek";

/** Construit un fournisseur à partir de son nom (base URL + clé + modèle). Partagé par l'app et les scripts. */
export function buildProvider(name: string, e: AiEnv): LlmProvider | null {
  if (name === "mock") return createMockProvider();
  if (name === "deepseek" && e.DEEPSEEK_API_KEY)
    return createOpenAiCompatibleProvider({
      name: "deepseek",
      baseUrl: e.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      apiKey: e.DEEPSEEK_API_KEY,
      model: e.DEEPSEEK_MODEL ?? "deepseek-v4-pro",
      lightModel: e.DEEPSEEK_LIGHT_MODEL ?? "deepseek-flash",
      supportsThinkingToggle: true,
    });
  if (name === "meta" && e.META_API_KEY)
    return createOpenAiCompatibleProvider({
      name: "meta",
      baseUrl: e.META_BASE_URL ?? "https://api.meta.ai/v1",
      apiKey: e.META_API_KEY,
      model: e.META_MODEL ?? "muse-spark-1.3-contributor",
      // Les modèles Meta raisonnent toujours : marge de sortie plus large et délai plus long.
      outputMargin: 2,
      defaultTimeoutMs: 110_000,
    });
  return null;
}

/** Fournisseurs de l'environnement (ordre AI_PRIMARY_PROVIDER → AI_FALLBACK_PROVIDER). */
export function buildProviders(e: AiEnv): LlmProvider[] {
  return providerOrder(e.AI_PRIMARY_PROVIDER ?? "meta", e.AI_FALLBACK_PROVIDER ?? "deepseek")
    .map((n) => buildProvider(n, e))
    .filter((p): p is LlmProvider => p !== null);
}

/**
 * Fournisseurs selon le choix de l'utilisateur : le préféré d'abord, l'autre en secours.
 * Le mode simulé de l'environnement (tests) l'emporte toujours.
 */
export function buildProvidersFor(preferred: ProviderName, e: AiEnv): LlmProvider[] {
  if (e.AI_PRIMARY_PROVIDER === "mock") return buildProviders(e);
  const other: ProviderName = preferred === "meta" ? "deepseek" : "meta";
  const order = e.AI_FALLBACK_PROVIDER === "none" ? [preferred] : [preferred, other];
  const list = order.map((n) => buildProvider(n, e)).filter((p): p is LlmProvider => p !== null);
  return list.length ? list : buildProviders(e);
}
