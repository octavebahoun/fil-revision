import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildProvidersFor } from "@/lib/ai/providers";
import { PreferenceRouter } from "@/lib/ai/preference";
import type { AiStore } from "@/lib/ai/router";
import { DEFAULT_SETTINGS, parseSettings } from "@/lib/settings";

const keys = { DEEPSEEK_API_KEY: "k", META_API_KEY: "k" };
const store: AiStore = {
  spentTodayUsd: async () => 0,
  logCall: async () => {},
  getCache: async () => null,
  setCache: async () => {},
};

describe("fournisseur IA choisi par l'utilisateur", () => {
  it("Meta par défaut dans les réglages", () => {
    expect(DEFAULT_SETTINGS.aiProvider).toBe("meta");
    expect(parseSettings({ aiProvider: "deepseek" }).aiProvider).toBe("deepseek");
    expect(parseSettings({ aiProvider: "autre" }).aiProvider).toBe("meta");
  });

  it("le préféré d'abord, l'autre en secours ; le simulé l'emporte en test", () => {
    expect(buildProvidersFor("meta", keys).map((p) => p.name)).toEqual(["meta", "deepseek"]);
    expect(buildProvidersFor("deepseek", keys).map((p) => p.name)).toEqual(["deepseek", "meta"]);
    expect(buildProvidersFor("meta", { ...keys, AI_FALLBACK_PROVIDER: "none" }).map((p) => p.name)).toEqual(["meta"]);
    expect(buildProvidersFor("deepseek", { ...keys, AI_PRIMARY_PROVIDER: "mock", AI_FALLBACK_PROVIDER: "none" }).map((p) => p.name)).toEqual(["mock"]);
    // Clé absente : on retombe sur ce qui est disponible.
    expect(buildProvidersFor("meta", { DEEPSEEK_API_KEY: "k" }).map((p) => p.name)).toEqual(["deepseek"]);
  });

  it("le routeur suit la préférence de chaque utilisateur (mise en cache)", async () => {
    let reads = 0;
    const prefs: Record<string, "meta" | "deepseek"> = { a: "deepseek" };
    const router = new PreferenceRouter({ AI_PRIMARY_PROVIDER: "mock", AI_FALLBACK_PROVIDER: "none" }, store, 2, async (id) => {
      reads++;
      return prefs[id] ?? null;
    });
    expect(await router.preferenceOf("a")).toBe("deepseek");
    expect(await router.preferenceOf("b")).toBe("meta");
    await router.preferenceOf("a");
    expect(reads).toBe(2);
    const out = await router.generate({ userId: "a", purpose: "probe", schema: z.object({ ok: z.boolean() }), system: "s", user: "u", mock: () => ({ ok: true }) });
    expect(out.data.ok).toBe(true);
    expect(await router.remainingBudgetUsd("a")).toBe(2);
  });

  it("une erreur de lecture du réglage retombe sur Meta", async () => {
    const router = new PreferenceRouter({ AI_PRIMARY_PROVIDER: "mock" }, store, 2, async () => {
      throw new Error("base indisponible");
    });
    expect(await router.preferenceOf("x")).toBe("meta");
  });
});
