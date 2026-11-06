import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ComfortSettings } from "@/components/settings/comfort-settings";
import { ReminderSettings } from "@/components/settings/reminder-settings";
import { AiSettings } from "@/components/settings/ai-settings";

export const metadata: Metadata = { title: "Réglages" };

export default function ReglagesPage() {
  return (
    <>
      <PageHeader title="Réglages" subtitle="Tout est enregistré dès que tu changes quelque chose." />
      <div className="flex flex-col gap-6">
        <ComfortSettings />
        <ReminderSettings vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        <AiSettings />
      </div>
    </>
  );
}
