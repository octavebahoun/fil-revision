import type { Metadata } from "next";
import { OfflineHome } from "@/components/offline/offline-home";

export const metadata: Metadata = { title: "Hors ligne" };

/** Page servie par le service worker quand le réseau manque. */
export default function HorsLignePage() {
  return (
    <main id="contenu" className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
      <OfflineHome />
    </main>
  );
}
