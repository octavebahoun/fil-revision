"use client";
import { Volume2, Square } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useSettingsOptional } from "@/components/providers/settings-provider";

/** Lecture audio avec la synthèse vocale du navigateur (vitesse réglable dans Réglages). */
export function SpeakButton({
  text,
  lang = "fr-FR",
  label = "Écouter",
}: {
  text: string;
  lang?: string;
  label?: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const supported = useSyncExternalStore(
    () => () => {},
    () => "speechSynthesis" in window,
    () => false,
  );
  const settings = useSettingsOptional();
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const synth = window.speechSynthesis;
        if (speaking) {
          synth.cancel();
          setSpeaking(false);
          return;
        }
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = settings?.settings.ttsRate ?? 1;
        const voice = synth.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)));
        if (voice) u.voice = voice;
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        setSpeaking(true);
        synth.speak(u);
      }}
      aria-pressed={speaking}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {speaking ? <Square className="size-5" aria-hidden="true" /> : <Volume2 className="size-5" aria-hidden="true" />}
      <span className="sr-only">{speaking ? "Arrêter la lecture" : label}</span>
    </button>
  );
}
