import { buildProvidersFor, type AiEnv, type ProviderName } from "./providers";
import { AiRouter, type AiStore, type GenerateOptions, type GenerateResult } from "./router";

/** Ce qu'utilisent les traitements et les actions : générer et connaître le budget restant. */
export interface AiGenerator {
  generate<T>(opts: GenerateOptions<T>): Promise<GenerateResult<T>>;
  remainingBudgetUsd(userId: string): Promise<number>;
}

/**
 * Routeur qui respecte le fournisseur choisi par l'utilisateur dans ses réglages
 * (Meta par défaut, DeepSeek en secours, ou l'inverse). Le choix est relu au plus toutes les 60 s.
 */
export class PreferenceRouter implements AiGenerator {
  private routers = new Map<ProviderName, AiRouter>();
  private cache = new Map<string, { value: ProviderName; at: number }>();

  constructor(
    private readonly env: AiEnv,
    private readonly store: AiStore,
    private readonly dailyBudgetUsd: number,
    private readonly readPreference: (userId: string) => Promise<ProviderName | null>,
    private readonly ttlMs = 60_000,
  ) {}

  routerFor(preferred: ProviderName): AiRouter {
    let r = this.routers.get(preferred);
    if (!r) {
      r = new AiRouter(buildProvidersFor(preferred, this.env), this.store, this.dailyBudgetUsd);
      this.routers.set(preferred, r);
    }
    return r;
  }

  async preferenceOf(userId: string): Promise<ProviderName> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;
    let value: ProviderName = "meta";
    try {
      value = (await this.readPreference(userId)) ?? "meta";
    } catch {
      /* lecture impossible : valeur par défaut */
    }
    this.cache.set(userId, { value, at: Date.now() });
    return value;
  }

  async generate<T>(opts: GenerateOptions<T>): Promise<GenerateResult<T>> {
    return this.routerFor(await this.preferenceOf(opts.userId)).generate(opts);
  }

  remainingBudgetUsd(userId: string): Promise<number> {
    return this.routerFor("meta").remainingBudgetUsd(userId);
  }
}
