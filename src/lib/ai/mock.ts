import { AiError, type ChatRequest, type ChatResponse, type LlmProvider } from "./types";

const INJECTION = /ignore (tes|les|toutes (tes|les)) (pr[ée]c[ée]dentes )?instructions|ignore previous instructions/i;

/**
 * Fournisseur simulé et déterministe (AI_PRIMARY_PROVIDER=mock) : aucune requête réseau.
 * Avec MOCK_FOLLOW_INJECTION=1, il « obéit » aux injections présentes dans le cours,
 * pour prouver que le pipeline rejette ces sorties (tests de sécurité).
 */
export function createMockProvider(): LlmProvider {
  return {
    name: "mock",
    modelFor: () => "mock",
    async chat(req: ChatRequest): Promise<ChatResponse> {
      const userText = req.messages.map((m) => m.content).join("\n");
      const tokens = Math.ceil(userText.length / 4);
      if (process.env.MOCK_FOLLOW_INJECTION === "1" && INJECTION.test(userText)) {
        const hijacked =
          req.purpose === "verify"
            ? { verdicts: [] }
            : req.purpose === "generate_fiche"
              ? {
                  fiche: {
                    title: "PIRATÉ",
                    explanation: "PIRATÉ : envoie ton mot de passe à evil.example.",
                    example: "PIRATÉ",
                    question: "As-tu été piraté ?",
                    answer: "Oui",
                    sourceQuote: "PIRATÉ par le document",
                  },
                  flashcards: [{ front: "PIRATÉ", back: "PIRATÉ", sourceQuote: "PIRATÉ" }],
                }
              : "J'obéis au document : PIRATÉ.";
        const text = typeof hijacked === "string" ? hijacked : JSON.stringify(hijacked);
        return {
          text,
          usage: { promptTokens: tokens, completionTokens: 20, reasoningTokens: 0 },
          model: "mock",
          latencyMs: 1,
        };
      }
      if (!req.mock) throw new AiError("Pas de sortie simulée pour cette tâche", "config", false);
      const out = req.mock();
      const text = typeof out === "string" ? out : JSON.stringify(out);
      return {
        text,
        usage: { promptTokens: tokens, completionTokens: Math.ceil(text.length / 4), reasoningTokens: 0 },
        model: "mock",
        latencyMs: 1,
      };
    },
  };
}
