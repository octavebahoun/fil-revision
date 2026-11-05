import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { sendToUser } from "@/lib/push/send";

/** « Tester la notification » depuis les réglages. */
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "non connecté" }, { status: 401 });
  if (!(await rateLimit("upload", `push-test:${data.user.id}`)))
    return NextResponse.json({ error: "trop" }, { status: 429 });
  const sent = await sendToUser(data.user.id, {
    title: "Fil",
    body: "C'est bon : les rappels fonctionnent sur cet appareil.",
  });
  return NextResponse.json({ sent });
}
