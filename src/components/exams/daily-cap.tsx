"use client";
import { useId } from "react";
import { useSettings } from "@/components/providers/settings-provider";

/** Charge quotidienne maximale du planning (réglable). */
export function DailyCap() {
  const { settings, update } = useSettings();
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex justify-between font-semibold">
        Charge maximale par jour{" "}
        <span className="font-normal text-muted-foreground">{settings.dailyCapMinutes} min</span>
      </label>
      <input
        id={id}
        type="range"
        min={10}
        max={120}
        step={5}
        value={settings.dailyCapMinutes}
        onChange={(e) => update({ dailyCapMinutes: Number(e.target.value) })}
        className="h-11 w-full accent-[var(--primary)]"
      />
    </div>
  );
}
