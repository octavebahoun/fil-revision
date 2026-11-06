import { AiError, type ChatRequest, type ChatResponse, type LlmProvider } from "./types";

type Config = {
  name: "deepseek" | "meta";
  baseUrl: string;
  apiKey: string;
  model: string;
  lightModel?: string;
  /** Les modèles qui raisonnent consomment des tokens de sortie avant de répondre. */
  outputMargin?: number;
  /** Paramètre propre au fournisseur pour couper le raisonnement (DeepSeek : thinking.type = disabled). */
  supportsThinkingToggle?: boolean;
  /** Délai par défaut d'un appel (Meta raisonne plus longtemps que DeepSeek). */
  defaultTimeoutMs?: number;
};

type OpenAiResponse = {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  error?: { message?: string };
};

/** Adaptateur générique pour toute API compatible OpenAI (/chat/completions). */
export function createOpenAiCompatibleProvider(cfg: Config, fetchImpl: typeof fetch = fetch): LlmProvider {
  const base = cfg.baseUrl.replace(/\/$/, "");
  return {
    name: cfg.name,
    modelFor(tier) {
      return tier === "light" && cfg.lightModel ? cfg.lightModel : cfg.model;
    },
    async chat(req: ChatRequest): Promise<ChatResponse> {
      const model = this.modelFor(req.tier);
      const started = Date.now();
      let res: Response;
      try {
        res = await fetchImpl(`${base}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify({
            model,
            messages: req.messages,
            max_tokens: Math.ceil(req.maxTokens * (cfg.outputMargin ?? 1)),
            temperature: req.temperature ?? 0.3,
            ...(req.json ? { response_format: { type: "json_object" } } : {}),
            ...(cfg.supportsThinkingToggle && req.reasoning === "off" ? { thinking: { type: "disabled" } } : {}),
          }),
          signal: AbortSignal.timeout(req.timeoutMs ?? cfg.defaultTimeoutMs ?? 55_000),
        });
      } catch (err) {
        const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
        throw new AiError(timeout ? "Délai dépassé" : "Erreur réseau", timeout ? "timeout" : "network", true);
      }
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        throw new AiError(`HTTP ${res.status}`, res.status === 429 ? "rate_limited" : "http", retryable, res.status);
      }
      const body = (await res.json().catch(() => ({}))) as OpenAiResponse;
      const text = body.choices?.[0]?.message?.content ?? "";
      const usage = {
        promptTokens: body.usage?.prompt_tokens ?? 0,
        completionTokens: body.usage?.completion_tokens ?? 0,
        reasoningTokens: body.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
      };
      if (!text.trim()) {
        // Raisonnement trop long : la limite de sortie a été consommée avant la réponse.
        const err = new AiError("Réponse vide", "empty", true);
        Object.assign(err, { usage, model });
        throw err;
      }
      return { text, usage, model: body.model ?? model, latencyMs };
    },
  };
}
