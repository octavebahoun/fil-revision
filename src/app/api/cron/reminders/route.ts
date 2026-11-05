import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { bearerMatches } from "@/lib/secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSettings } from "@/lib/settings";
import { dueReminders, parisClock, reminderMessage } from "@/lib/push/reminders";
import { sendToUser } from "@/lib/push/send";

/** Appelé toutes les 5 minutes par Supabase Cron : envoie les rappels dont l'heure est venue. */
async function handle(request: NextRequest) {
  const e = env();
  if (!bearerMatches(request.headers.get("authorization"), e.CRON_SECRET))
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const db = createAdminClient();
  const { data: profiles } = await db.from("profiles").select("user_id, settings, last_reminder_on").limit(1000);
  const due = dueReminders(
    (profiles ?? []).map((p) => {
      const s = parseSettings(p.settings);
      return {
        userId: p.user_id,
        enabled: s.reminder.enabled,
        time: s.reminder.time,
        lastReminderOn: p.last_reminder_on,
      };
    }),
    new Date(),
  );
  const { day } = parisClock(new Date());
  let sent = 0;
  for (const p of due) {
    // Marqué d'abord : un rappel par jour au plus, même si l'envoi échoue.
    await db.from("profiles").update({ last_reminder_on: day }).eq("user_id", p.userId);
    sent += await sendToUser(p.userId, reminderMessage(day));
  }
  return NextResponse.json({ due: due.length, sent });
}

export const GET = handle;
export const POST = handle;
