import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { bearerMatches } from "@/lib/secret";
import { runWorker } from "@/lib/jobs/run";

export const maxDuration = 300;

/** Appelé chaque minute par Supabase Cron (pg_cron + pg_net), et par Vercel Cron en secours. */
async function handle(request: NextRequest) {
  const e = env();
  if (!bearerMatches(request.headers.get("authorization"), e.CRON_SECRET, e.JOBS_SECRET)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  const result = await runWorker({ budgetMs: 240_000, concurrency: 6 });
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
