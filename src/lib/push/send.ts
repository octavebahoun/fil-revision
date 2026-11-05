import "server-only";
import webpush from "web-push";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

let configured = false;
function configure() {
  if (configured) return true;
  const e = env();
  if (!e.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY || !e.VAPID_SUBJECT) return false;
  webpush.setVapidDetails(e.VAPID_SUBJECT, e.NEXT_PUBLIC_VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

/** Envoie une notification à tous les appareils d'un utilisateur ; supprime les abonnements expirés. */
export async function sendToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<number> {
  if (!configure()) return 0;
  const db = createAdminClient();
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...payload, url: payload.url ?? "/" }),
        { TTL: 3600, urgency: "normal" },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      else log("warn", "push_failed", { status: status ?? 0 });
    }
  }
  return sent;
}
