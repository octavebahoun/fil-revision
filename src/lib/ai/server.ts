import "server-only";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";
import { parseSettings } from "@/lib/settings";
import type { ProviderName } from "./providers";
import { PreferenceRouter, type AiGenerator } from "./preference";
import type { AiStore } from "./router";

/** Début de la journée à Paris, en ISO (le budget se remet à zéro à minuit, heure locale). */
export function startOfParisDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const elapsedMs = ((get("hour") * 60 + get("minute")) * 60 + get("second")) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - elapsedMs).toISOString();
}

export const supabaseAiStore: AiStore = {
  async spentTodayUsd(userId) {
    const { data, error } = await createAdminClient()
      .from("ai_calls")
      .select("cost_usd")
      .eq("user_id", userId)
      .gte("created_at", startOfParisDay());
    if (error) throw error;
    return (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  },
  async logCall(e) {
    const { error } = await createAdminClient()
      .from("ai_calls")
      .insert({
        user_id: e.userId,
        provider: e.provider,
        model: e.model,
        purpose: e.purpose,
        prompt_tokens: e.promptTokens,
        completion_tokens: e.completionTokens,
        reasoning_tokens: e.reasoningTokens,
        cost_usd: Number(e.costUsd.toFixed(6)),
        ok: e.ok,
        error_code: e.errorCode ?? null,
        latency_ms: e.latencyMs ?? null,
      });
    if (error) log("error", "ai_log_failed", { code: error.code });
    log(e.ok ? "info" : "warn", "ai_call", {
      provider: e.provider,
      model: e.model,
      purpose: e.purpose,
      in: e.promptTokens,
      out: e.completionTokens,
      cost: Number(e.costUsd.toFixed(5)),
      ok: e.ok,
      code: e.errorCode,
    });
  },
  async getCache(userId, key) {
    const { data } = await createAdminClient()
      .from("ai_cache")
      .select("output")
      .eq("user_id", userId)
      .eq("key", key)
      .maybeSingle();
    return data?.output ?? null;
  },
  async setCache(userId, key, purpose, value) {
    await createAdminClient()
      .from("ai_cache")
      .upsert({ user_id: userId, key, purpose, output: value as never }, { onConflict: "user_id,key" });
  },
};

/** Fournisseur choisi par l'utilisateur dans Réglages (Meta par défaut). */
export async function readProviderPreference(userId: string): Promise<ProviderName | null> {
  const { data } = await createAdminClient().from("profiles").select("settings").eq("user_id", userId).maybeSingle();
  return parseSettings(data?.settings).aiProvider;
}

let router: PreferenceRouter | null = null;

/** Routeur IA de l'app : respecte le choix Meta / DeepSeek de chaque utilisateur. */
export function getAiRouter(): AiGenerator {
  if (router) return router;
  const e = env();
  router = new PreferenceRouter(e, supabaseAiStore, e.AI_DAILY_BUDGET_USD, readProviderPreference);
  return router;
}

export function aiMode(): "mock" | "real" {
  return env().AI_PRIMARY_PROVIDER === "mock" ? "mock" : "real";
}
