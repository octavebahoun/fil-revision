"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Parking à pensées : noter une idée en 2 secondes sans quitter la session. */
export function ParkingInput({ onSave, onClose }: { onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => ref.current?.focus(), []);
  return (
    <form
      className="flex animate-card-in flex-col gap-2 rounded-2xl border bg-card p-4 shadow-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSave(text.trim());
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <label htmlFor={id} className="font-semibold">
        Une idée en tête ? Note-la, on la garde pour après.
      </label>
      <div className="flex gap-2">
        <Input
          ref={ref}
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          autoComplete="off"
        />
        <Button type="submit">Garder</Button>
      </div>
    </form>
  );
}
