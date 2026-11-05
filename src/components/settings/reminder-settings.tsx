"use client";
import { useEffect, useId, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/components/providers/settings-provider";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Status = "unsupported" | "ios-not-installed" | "denied" | "off" | "on";

/** Rappels doux à l'heure choisie (notifications push web, désactivables à tout moment). */
export function ReminderSettings({ vapidKey }: { vapidKey: string | null }) {
  const { settings, update } = useSettings();
  const [status, setStatus] = useState<Status>("off");
  const [message, setMessage] = useState<string | null>(null);
  const timeId = useId();

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone;
      if (ios && !standalone) return setStatus("ios-not-installed");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidKey) return setStatus("unsupported");
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, [vapidKey]);

  const enable = async () => {
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setStatus(permission === "denied" ? "denied" : "off");
      const reg =
        (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey!),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe");
      setStatus("on");
      update({ reminder: { ...settings.reminder, enabled: true } });
    } catch {
      setMessage("L'activation n'a pas abouti. Réessaie, ou vérifie les autorisations du navigateur.");
    }
  };

  const disable = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setStatus("off");
    update({ reminder: { ...settings.reminder, enabled: false } });
  };

  return (
    <section className="flex flex-col gap-5 rounded-3xl border bg-card p-5">
      <h2 className="text-lg font-bold">Rappels</h2>
      <p className="text-muted-foreground">
        Un message doux par jour, à l&apos;heure que tu choisis. Jamais de reproche.
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor={timeId} className="font-semibold">
          Heure du rappel
        </label>
        <input
          id={timeId}
          type="time"
          value={settings.reminder.time}
          onChange={(e) => e.target.value && update({ reminder: { ...settings.reminder, time: e.target.value } })}
          className="h-12 w-40 rounded-xl border border-input bg-card px-3 text-base text-foreground"
        />
      </div>
      {status === "ios-not-installed" ? (
        <p className="rounded-2xl bg-info-soft px-4 py-3">
          Sur iPhone, les rappels ne marchent que si Fil est installé : touche <strong>Partager</strong>, puis{" "}
          <strong>Sur l&apos;écran d&apos;accueil</strong>, et ouvre Fil depuis cette icône.
        </p>
      ) : status === "unsupported" ? (
        <p className="rounded-2xl bg-info-soft px-4 py-3">
          Ce navigateur ne gère pas les notifications. Essaie Chrome, Edge ou Firefox.
        </p>
      ) : status === "denied" ? (
        <p className="rounded-2xl bg-warning-soft px-4 py-3">
          Les notifications sont bloquées pour Fil dans ton navigateur. Autorise-les dans ses réglages, puis reviens
          ici.
        </p>
      ) : status === "on" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              fetch("/api/push/test", { method: "POST" }).then(() => setMessage("Notification de test envoyée."))
            }
          >
            <Bell aria-hidden="true" /> Tester
          </Button>
          <Button variant="ghost" onClick={disable}>
            <BellOff aria-hidden="true" /> Désactiver les rappels
          </Button>
        </div>
      ) : (
        <Button onClick={enable} className="w-fit">
          <Bell aria-hidden="true" /> Activer les rappels sur cet appareil
        </Button>
      )}
      {message ? (
        <p role="status" className="text-muted-foreground">
          {message}
        </p>
      ) : null}
    </section>
  );
}
