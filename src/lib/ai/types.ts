export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type Purpose =
  | "segment"
  | "generate_fiche"
  | "generate_quiz"
  | "verify"
  | "regenerate_card"
  | "tutor"
  | "feynman"
  | "exercise_guide"
  | "exercise_feedback"
  | "mindmap"
  | "code_exercise"
  | "probe";

export type ChatRequest = {
  purpose: Purpose;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  json: boolean;
  tier: "main" | "light";
  timeoutMs?: number;
  /** Raisonnement du modèle : « off » quand la tâche est une extraction fidèle (moins de tokens, moins cher). */
  reasoning?: "on" | "off";
  /** Sortie déterministe utilisée par le fournisseur simulé (mock). */
  mock?: () => unknown;
};

export type Usage = { promptTokens: number; completionTokens: number; reasoningTokens: number };

export type ChatResponse = { text: string; usage: Usage; model: string; latencyMs: number };

/** Interface unique : base URL + clé + modèle. Aucun SDK propriétaire dans le code métier. */
export interface LlmProvider {
  readonly name: "deepseek" | "meta" | "mock";
  modelFor(tier: "main" | "light"): string;
  chat(req: ChatRequest): Promise<ChatResponse>;
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly code:
      "budget" | "empty" | "http" | "timeout" | "network" | "schema" | "rate_limited" | "no_provider" | "config",
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}
