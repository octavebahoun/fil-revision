import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AiRouter, providerOrder, type AiStore, type CallLog } from "@/lib/ai/router";
import { AiError, type ChatRequest, type LlmProvider } from "@/lib/ai/types";
import { createOpenAiCompatibleProvider } from "@/lib/ai/openai-compatible";
import { createMockProvider } from "@/lib/ai/mock";
import { costUsd, estimateCostUsd, priceFor } from "@/lib/ai/pricing";

function memoryStore(spent = 0) {
  const logs: CallLog[] = [];
  const cache = new Map<string, unknown>();
  const store: AiStore = {
    spentTodayUsd: async () => spent + logs.reduce((s, l) => s + l.costUsd, 0),
    logCall: async (e) => void logs.push(e),
    getCache: async (_u, k) => cache.get(k) ?? null,
    setCache: async (_u, k, _p, v) => void cache.set(k, v),
  };
  return { store, logs, cache };
}

function fakeProvider(
  name: "deepseek" | "meta",
  replies: Array<string | AiError>,
  seen: ChatRequest[] = [],
): LlmProvider {
  let i = 0;
  return {
    name,
    modelFor: () => `${name}-model`,
    async chat(req) {
      seen.push(JSON.parse(JSON.stringify({ ...req, mock: undefined })));
      const r = replies[Math.min(i++, replies.length - 1)]!;
      if (r instanceof AiError) throw r;
      return {
        text: r,
        usage: { promptTokens: 100, completionTokens: 50, reasoningTokens: 10 },
        model: `${name}-model`,
        latencyMs: 5,
      };
    },
  };
}

const Schema = z.object({ ok: z.boolean(), mot: z.string() });
const base = { userId: "u1", purpose: "probe" as const, schema: Schema, system: "s", user: "u" };

describe("routeur IA", () => {
  it("valide la sortie avec Zod", async () => {
    const { store, logs } = memoryStore();
    const r = new AiRouter([fakeProvider("deepseek", ['{"ok":true,"mot":"fil"}'])], store, 2);
    const out = await r.generate(base);
    expect(out.data).toEqual({ ok: true, mot: "fil" });
    expect(logs[0]?.ok).toBe(true);
  });

  it("rejette une sortie hors schéma puis régénère avec un rappel du format", async () => {
    const { store, logs } = memoryStore();
    const seen: ChatRequest[] = [];
    const r = new AiRouter([fakeProvider("deepseek", ['{"ok":"oui"}', '{"ok":true,"mot":"ok"}'], seen)], store, 2);
    const out = await r.generate(base);
    expect(out.data.mot).toBe("ok");
    expect(logs.map((l) => l.ok)).toEqual([false, true]);
    expect(seen[1]!.messages.at(-1)!.content).toMatch(/ne respecte pas le format/);
  });

  it("bascule sur le secours si le principal tombe", async () => {
    const { store } = memoryStore();
    const r = new AiRouter(
      [
        fakeProvider("deepseek", [new AiError("HTTP 503", "http", true, 503)]),
        fakeProvider("meta", ['{"ok":true,"mot":"secours"}']),
      ],
      store,
      2,
    );
    const out = await r.generate(base);
    expect(out.provider).toBe("meta");
  });

  it("une réponse vide (raisonnement trop long) est relancée avec plus de marge", async () => {
    const { store } = memoryStore();
    const seen: ChatRequest[] = [];
    const r = new AiRouter(
      [fakeProvider("meta", [new AiError("vide", "empty", true), '{"ok":true,"mot":"x"}'], seen)],
      store,
      2,
    );
    await r.generate({ ...base, maxTokens: 1000 });
    expect(seen[1]!.maxTokens).toBeGreaterThan(seen[0]!.maxTokens);
  });

  it("refuse au-delà du budget quotidien", async () => {
    const { store } = memoryStore(5);
    const r = new AiRouter([fakeProvider("deepseek", ['{"ok":true,"mot":"x"}'])], store, 2);
    await expect(r.generate(base)).rejects.toMatchObject({ code: "budget" });
    expect(await r.remainingBudgetUsd("u1")).toBe(0);
  });

  it("cache par empreinte : aucun nouvel appel pour un contenu inchangé", async () => {
    const { store, logs } = memoryStore();
    const r = new AiRouter([fakeProvider("deepseek", ['{"ok":true,"mot":"c"}'])], store, 2);
    await r.generate({ ...base, cacheKey: "k1" });
    const again = await r.generate({ ...base, cacheKey: "k1" });
    expect(again.cached).toBe(true);
    expect(logs).toHaveLength(1);
  });

  it("contrôle métier : une sortie refusée par check est régénérée", async () => {
    const { store } = memoryStore();
    const r = new AiRouter(
      [fakeProvider("deepseek", ['{"ok":true,"mot":"trop long"}', '{"ok":true,"mot":"bref"}'])],
      store,
      2,
    );
    const out = await r.generate({ ...base, check: (o) => (o.mot.length > 5 ? "trop long" : null) });
    expect(out.data.mot).toBe("bref");
  });

  it("échoue proprement si tout échoue", async () => {
    const { store } = memoryStore();
    const r = new AiRouter([fakeProvider("deepseek", ["pas du json"])], store, 2);
    await expect(r.generate(base)).rejects.toMatchObject({ code: "schema" });
  });

  it("ordre des fournisseurs", () => {
    expect(providerOrder("deepseek", "meta")).toEqual(["deepseek", "meta"]);
    expect(providerOrder("mock", "none")).toEqual(["mock"]);
    expect(providerOrder("meta", "meta")).toEqual(["meta"]);
  });

  it("le simulé est déterministe et ne coûte rien", async () => {
    const { store, logs } = memoryStore();
    const r = new AiRouter([createMockProvider()], store, 2);
    const a = await r.generate({ ...base, mock: () => ({ ok: true, mot: "m" }) });
    expect(a.data.mot).toBe("m");
    expect(logs[0]!.costUsd).toBe(0);
  });
});

describe("adaptateur compatible OpenAI", () => {
  const ok =
    (body: unknown, status = 200) =>
    async () =>
      new Response(JSON.stringify(body), { status });
  const req: ChatRequest = {
    purpose: "probe",
    messages: [{ role: "user", content: "x" }],
    maxTokens: 100,
    json: true,
    tier: "main",
  };

  it("lit le contenu et l'usage (tokens de raisonnement compris)", async () => {
    const p = createOpenAiCompatibleProvider(
      { name: "deepseek", baseUrl: "https://x", apiKey: "k", model: "m" },
      ok({
        choices: [{ message: { content: "{}" } }],
        usage: { prompt_tokens: 3, completion_tokens: 9, completion_tokens_details: { reasoning_tokens: 7 } },
      }) as typeof fetch,
    );
    const r = await p.chat(req);
    expect(r.usage).toEqual({ promptTokens: 3, completionTokens: 9, reasoningTokens: 7 });
  });
  it("contenu vide = erreur à relancer", async () => {
    const p = createOpenAiCompatibleProvider(
      { name: "meta", baseUrl: "https://x", apiKey: "k", model: "m" },
      ok({ choices: [{ message: { content: "" } }] }) as typeof fetch,
    );
    await expect(p.chat(req)).rejects.toMatchObject({ code: "empty", retryable: true });
  });
  it("429 et 5xx sont relançables, 400 non", async () => {
    const p429 = createOpenAiCompatibleProvider(
      { name: "meta", baseUrl: "https://x", apiKey: "k", model: "m" },
      ok({}, 429) as typeof fetch,
    );
    await expect(p429.chat(req)).rejects.toMatchObject({ code: "rate_limited", retryable: true });
    const p400 = createOpenAiCompatibleProvider(
      { name: "meta", baseUrl: "https://x", apiKey: "k", model: "m" },
      ok({}, 400) as typeof fetch,
    );
    await expect(p400.chat(req)).rejects.toMatchObject({ retryable: false });
  });
  it("modèle léger pour les tâches légères, marge de sortie pour Meta", async () => {
    let sent: { model: string; max_tokens: number } | null = null;
    const f = (async (_u: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }));
    }) as unknown as typeof fetch;
    const p = createOpenAiCompatibleProvider(
      { name: "meta", baseUrl: "https://x/", apiKey: "k", model: "lourd", lightModel: "leger", outputMargin: 2 },
      f,
    );
    await p.chat({ ...req, tier: "light" });
    expect(sent!.model).toBe("leger");
    expect(sent!.max_tokens).toBe(200);
  });
  it("erreur réseau et délai", async () => {
    const p = createOpenAiCompatibleProvider(
      { name: "meta", baseUrl: "https://x", apiKey: "k", model: "m" },
      (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    );
    await expect(p.chat(req)).rejects.toMatchObject({ code: "network" });
  });
});

describe("coûts", () => {
  it("calcule le coût et estime une génération", () => {
    expect(costUsd("deepseek-flash", 1_000_000, 0)).toBeCloseTo(priceFor("deepseek-flash").input);
    expect(estimateCostUsd("mock", 10_000, 1000)).toBe(0);
    expect(priceFor("inconnu").output).toBeGreaterThan(0);
  });
});
