import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/load-env";
loadEnv({ prod: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const { data: docs } = await db
  .from("documents")
  .select("title, status, kind, page_count, error_message, estimated_cost_usd, size_bytes");
const by: Record<string, number> = {};
for (const d of docs ?? []) by[d.status] = (by[d.status] ?? 0) + 1;
console.log("documents:", docs?.length, JSON.stringify(by));
for (const d of (docs ?? []).filter((x) => x.status === "error"))
  console.log("  ✗", d.title, "|", Math.round(d.size_bytes / 1024), "Ko |", d.error_message);
const est = (docs ?? []).reduce((s, d) => s + Number(d.estimated_cost_usd ?? 0), 0);
console.log("estimation totale (docs déjà segmentés) :", est.toFixed(2), "$");
const { data: calls } = await db.from("ai_calls").select("cost_usd");
console.log("dépensé (estimé) :", (calls ?? []).reduce((s, c) => s + Number(c.cost_usd), 0).toFixed(3), "$");
