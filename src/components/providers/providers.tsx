"use client";
import { setNonce } from "get-nonce";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnnouncerProvider } from "@/components/providers/announcer";
import { ServiceWorkerRegistrar } from "@/components/offline/sw-register";

export function Providers({ nonce, children }: { nonce?: string; children: ReactNode }) {
  // Les styles injectés par Radix (verrouillage du défilement) reçoivent le nonce CSP.
  if (nonce) setNonce(nonce);
  return (
    <TooltipProvider delayDuration={400}>
      <AnnouncerProvider>
        {children}
        <ServiceWorkerRegistrar />
      </AnnouncerProvider>
    </TooltipProvider>
  );
}
