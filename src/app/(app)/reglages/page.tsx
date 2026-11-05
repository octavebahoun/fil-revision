import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ComfortSettings } from "@/components/settings/comfort-settings";

export const metadata: Metadata = { title: "Réglages" };

export default function ReglagesPage() {
  return (
    <>
      <PageHeader title="Réglages" subtitle="Tout est enregistré dès que tu changes quelque chose." />
      <ComfortSettings />
    </>
  );
}
