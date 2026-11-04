"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DISPLAY_COOKIE, displayPrefs, serializeDisplayCookie, type Settings } from "@/lib/settings";
import { saveSettingsAction } from "@/lib/settings-actions";

type Ctx = { settings: Settings; update: (patch: Partial<Settings>) => void };
const SettingsContext = createContext<Ctx | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings hors SettingsProvider");
  return ctx;
}

/** Applique les réglages d'affichage au document, sans rechargement. */
function applyToDocument(s: Settings) {
  const d = document.documentElement;
  d.setAttribute("data-theme-pref", s.theme);
  const resolved =
    s.theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : s.theme;
  d.setAttribute("data-theme", resolved);
  d.setAttribute("data-font", s.font);
  d.setAttribute("data-motion", s.motion);
  d.style.setProperty("--reading-size", `${(1.125 * s.fontScale).toFixed(3)}rem`);
  d.style.setProperty("--reading-leading", String(s.lineHeight));
  // Cookie d'affichage : le serveur rend directement le bon thème au prochain chargement.
  document.cookie = `${DISPLAY_COOKIE}=${serializeDisplayCookie(displayPrefs(s))}; path=/; max-age=31536000; samesite=lax`;
}

export function SettingsProvider({ initial, children }: { initial: Settings; children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(initial);

  useEffect(() => {
    applyToDocument(settings);
    try {
      localStorage.setItem("fil:settings", JSON.stringify(settings));
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    // Sauvegarde immédiate ; hors ligne, la valeur reste appliquée localement.
    saveSettingsAction(patch).catch(() => {});
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
