"use client";
import Link from "next/link";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/auth/actions";

type Field = { name: "email" | "password"; label: string; autoComplete: string; hint?: string };

export function AuthForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
  hidden,
  footer,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  fields: Field[];
  submitLabel: string;
  pendingLabel: string;
  hidden?: Record<string, string>;
  footer?: { href: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const baseId = useId();
  const messageId = `${baseId}-msg`;

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-3xl border bg-card p-6 shadow-sm" noValidate>
      {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      {fields.map((f) => {
        const id = `${baseId}-${f.name}`;
        const hintId = f.hint ? `${id}-hint` : undefined;
        const invalid = state && !state.ok && state.field === f.name;
        return (
          <div key={f.name} className="flex flex-col gap-2">
            <Label htmlFor={id} className="text-base">
              {f.label}
            </Label>
            <Input
              id={id}
              name={f.name}
              type={f.name === "password" ? "password" : "email"}
              autoComplete={f.autoComplete}
              required
              aria-invalid={invalid || undefined}
              aria-describedby={[hintId, state ? messageId : undefined].filter(Boolean).join(" ") || undefined}
              inputMode={f.name === "email" ? "email" : undefined}
            />
            {f.hint ? (
              <p id={hintId} className="text-sm text-muted-foreground">
                {f.hint}
              </p>
            ) : null}
          </div>
        );
      })}
      <div id={messageId} aria-live="polite" className="min-h-0">
        {state ? (
          <p
            className={`rounded-xl px-4 py-3 text-base ${state.ok ? "bg-success-soft" : "bg-warning-soft"}`}
            role={state.ok ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? pendingLabel : submitLabel}
      </Button>
      {footer ? (
        <nav aria-label="Autres options" className="flex flex-col items-center gap-1 text-base">
          {footer.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="min-h-11 content-center text-primary underline-offset-4 hover:underline"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </form>
  );
}
