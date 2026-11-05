import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib/load-env";
loadEnv({ prod: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const { data: docs } = await db
  .from("documents")
  .select("id, filename, title, status, size_bytes, page_count, subjects(name)")
  .order("created_at");
for (const d of docs ?? [])
  console.log(
    d.status.padEnd(10),
    String(Math.round(d.size_bytes / 1024)).padStart(6),
    "Ko |",
    (d.subjects as unknown as { name: string }).name.slice(0, 30).padEnd(30),
    "|",
    d.filename,
  );
