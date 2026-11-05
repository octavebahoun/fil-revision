import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { loadSessionCards } from "@/lib/review/sessions";
import type { SessionItem } from "@/lib/review/build";
import { SessionRunner } from "@/components/session/session-runner";

export const metadata: Metadata = { title: "Session" };

export default async function SessionPage({ params }: PageProps<"/session/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser();
  const { data: s } = await supabase
    .from("study_sessions")
    .select("id, mode, planned_minutes, items, position, status")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  const items = (s.items as SessionItem[]) ?? [];
  const cards = await loadSessionCards(supabase, items);
  return (
    <SessionRunner
      session={{
        id: s.id,
        mode: s.mode,
        plannedMinutes: s.planned_minutes,
        items,
        position: s.position,
        status: s.status === "done" ? "done" : "active",
      }}
      cards={cards}
    />
  );
}
