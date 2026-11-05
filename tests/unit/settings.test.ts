import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  displayPrefs,
  parseDisplayCookie,
  parseSettings,
  serializeDisplayCookie,
} from "@/lib/settings";

describe("réglages", () => {
  it("donne des valeurs par défaut calmes", () => {
    expect(DEFAULT_SETTINGS.sessionMinutes).toBe(10);
    expect(DEFAULT_SETTINGS.motion).toBe("normal");
    expect(DEFAULT_SETTINGS.examTimerDefault).toBe(false);
  });
  it("garde les champs valides et ignore les invalides", () => {
    const s = parseSettings({ theme: "dark", fontScale: 99, motion: "none" });
    expect(s.theme).toBe("dark");
    expect(s.motion).toBe("none");
    expect(s.fontScale).toBe(1);
  });
  it("supporte null et les objets vides", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
  });
  it("aller-retour du cookie d'affichage", () => {
    const p = displayPrefs(parseSettings({ theme: "contrast", font: "dyslexic", fontScale: 1.3 }));
    expect(parseDisplayCookie(serializeDisplayCookie(p))).toEqual(p);
  });
  it("cookie corrompu → valeurs par défaut", () => {
    expect(parseDisplayCookie("%7Bpas-du-json")).toEqual(displayPrefs(DEFAULT_SETTINGS));
    expect(parseDisplayCookie(undefined)).toEqual(displayPrefs(DEFAULT_SETTINGS));
  });
});
