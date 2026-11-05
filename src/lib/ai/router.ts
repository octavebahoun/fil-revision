import type { z } from "zod";
import { extractJson } from "./json";
import { costUsd } from "./pricing";
import { AiError, type ChatMessage, type ChatRequest, type LlmProvider, type Purpose } from "./types";

export type CallLog = {
  userId: string;
  provider: string;
  model: string;
  purpose: Purpose;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  costUsd: number;
  ok: boolean;
  errorCode?: string;
  latencyMs?: number;
};

/** Persistance du routeur (journal, budget, cache). Implémentée par Supabase, ou en mémoire pour les tests. */
export interface AiStore {
  spentTodayUsd(userId: string): Promise<number>;
  logCall(entry: CallLog): Promise<void>;
  getCache(userId: string, key: string): Promise<unknown | null>;
  setCache(userId: string, key: string, purpose: Purpose, value: unknown): Promise<void>;
}

export type GenerateOptions<T> = {
  userId: string;
  purpose: Purpose;
  tier?: "main" | "light";
  schema: z.ZodType<T>;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  cacheKey?: string;
  /** Contrôle métier supplémentaire ; renvoie un message d'erreur pour forcer une régénération. */
  check?: (out: T) => string | null;
  mock?: () => unknown;
  timeoutMs?: number;
  reasoning?: "on" | "off";
};

export type GenerateResult<T> = { data: T; provider: string; model: string; cached: boolean };

export class AiRouter {
  constructor(
    private readonly providers: LlmProvider[],
    private readonly store: AiStore,
    private readonly dailyBudgetUsd: number,
  ) {
    if (providers.length === 0) throw new AiError("Aucun fournisseur IA configuré", "no_provider", false);
  }

  async remainingBudgetUsd(userId: string): Promise<number> {
    return Math.max(0, this.dailyBudgetUsd - (await this.store.spentTodayUsd(userId)));
  }

  async generate<T>(opts: GenerateOptions<T>): Promise<GenerateResult<T>> {
    if (opts.cacheKey) {
      const hit = await this.store.getCache(opts.userId, opts.cacheKey);
      if (hit !== null) {
        const parsed = opts.schema.safeParse(hit);
        if (parsed.success && !opts.check?.(parsed.data))
          return { data: parsed.data, provider: "cache", model: "cache", cached: true };
      }
    }

    const tier = opts.tier ?? "main";
    let lastError: AiError | null = null;

    for (const provider of this.providers) {
      const messages: ChatMessage[] = [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ];
      // 2 tentatives par fournisseur : la seconde rappelle le format attendu.
      for (let attempt = 0; attempt < 2; attempt++) {
        if (provider.name !== "mock" && (await this.store.spentTodayUsd(opts.userId)) >= this.dailyBudgetUsd) {
          throw new AiError("Budget IA du jour atteint", "budget", false);
        }
        const req: ChatRequest = {
          purpose: opts.purpose,
          messages,
          maxTokens: opts.maxTokens ?? 6000,
          temperature: opts.temperature,
          json: true,
          tier,
          timeoutMs: opts.timeoutMs,
          reasoning: opts.reasoning,
          mock: opts.mock,
        };
        const model = provider.modelFor(tier);
        try {
          const res = await provider.chat(req);
          const cost = costUsd(res.model, res.usage.promptTokens, res.usage.completionTokens);
          let data: T;
          // Code d'erreur précis (chemin + type), sans aucun contenu de cours.
          let schemaCode = "schema:json";
          try {
            const parsed = opts.schema.safeParse(extractJson(res.text));
            if (!parsed.success) {
              const first = parsed.error.issues[0];
              schemaCode = `schema:${first?.path.join(".") ?? ""}:${first?.code ?? ""}`.slice(0, 80);
              throw new Error(
                parsed.error.issues
                  .slice(0, 3)
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .join("; "),
              );
            }
            data = parsed.data;
            const problem = opts.check?.(data);
            if (problem) {
              schemaCode = "schema:check";
              throw new Error(problem);
            }
          } catch (err) {
            await this.store.logCall({
              userId: opts.userId,
              provider: provider.name,
              model: res.model,
              purpose: opts.purpose,
              ...res.usage,
              costUsd: cost,
              ok: false,
              errorCode: schemaCode,
              latencyMs: res.latencyMs,
            });
            lastError = new AiError("Sortie hors schéma", "schema", true);
            messages.push(
              { role: "assistant", content: res.text.slice(0, 4000) },
              {
                role: "user",
                content: `Ta réponse ne respecte pas le format demandé (${(err as Error).message.slice(0, 300)}). Réponds de nouveau avec UNIQUEMENT l'objet JSON valide, en respectant toutes les limites de longueur.`,
              },
            );
            continue;
          }
          await this.store.logCall({
            userId: opts.userId,
            provider: provider.name,
            model: res.model,
            purpose: opts.purpose,
            ...res.usage,
            costUsd: cost,
            ok: true,
            latencyMs: res.latencyMs,
          });
          // Les sorties simulées ne vont jamais dans le cache (elles masqueraient une vraie génération).
          if (opts.cacheKey && provider.name !== "mock")
            await this.store.setCache(opts.userId, opts.cacheKey, opts.purpose, data);
          return { data, provider: provider.name, model: res.model, cached: false };
        } catch (err) {
          const e = err instanceof AiError ? err : new AiError("Erreur inattendue", "network", true);
          if (e.code === "budget") throw e;
          const usage = (err as { usage?: { promptTokens: number; completionTokens: number; reasoningTokens: number } })
            .usage;
          await this.store.logCall({
            userId: opts.userId,
            provider: provider.name,
            model,
            purpose: opts.purpose,
            promptTokens: usage?.promptTokens ?? 0,
            completionTokens: usage?.completionTokens ?? 0,
            reasoningTokens: usage?.reasoningTokens ?? 0,
            costUsd: usage ? costUsd(model, usage.promptTokens, usage.completionTokens) : 0,
            ok: false,
            errorCode: e.code,
          });
          lastError = e;
          if (e.code === "empty") {
            // Le modèle a raisonné jusqu'à la limite : on relance avec plus de marge.
            req.maxTokens = Math.ceil(req.maxTokens * 1.6);
            opts = { ...opts, maxTokens: req.maxTokens };
          }
          if (!e.retryable) break;
        }
      }
    }
    throw lastError ?? new AiError("Échec de génération", "no_provider", true);
  }
}

/** Fournisseur(s) configuré(s), dans l'ordre : principal puis secours. */
export function providerOrder(primary: string, fallback: string): string[] {
  const order = [primary];
  if (fallback !== "none" && fallback !== primary) order.push(fallback);
  return order;
}
