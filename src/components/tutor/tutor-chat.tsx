"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { BookOpen, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SpeakButton } from "@/components/cards/speak-button";
import { askTutorAction, type TutorCitation } from "@/lib/tutor/actions";

type Msg = { role: "user" | "assistant"; text: string; check?: string; citations?: TutorCitation[] };

/** « Explique-moi » : réponses courtes ancrées dans tes cours, avec 3 relances en un geste. */
export function TutorChat({
  notionId,
  notionTitle,
  autoSimple,
}: {
  notionId: string | null;
  notionTitle: string | null;
  autoSimple: boolean;
}) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputId = useId();
  const endRef = useRef<HTMLDivElement>(null);
  const autoDone = useRef(false);

  const send = (mode: "ask" | "simpler" | "example" | "quiz", text: string) => {
    if (pending) return;
    setError(null);
    const label =
      mode === "ask"
        ? text
        : mode === "simpler"
          ? "Plus simple, s'il te plaît."
          : mode === "example"
            ? "Un autre exemple ?"
            : "Interroge-moi.";
    setMessages((m) => [...m, { role: "user", text: label }]);
    start(async () => {
      const res = await askTutorAction({ threadId, notionId, message: text, mode });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setThreadId(res.threadId);
      setMessages((m) => [...m, { role: "assistant", text: res.reply, check: res.check, citations: res.citations }]);
    });
  };

  useEffect(() => {
    if (autoSimple && notionTitle && !autoDone.current) {
      autoDone.current = true;
      send("simpler", `Explique-moi plus simplement « ${notionTitle} ».`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSimple, notionTitle]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  const last = messages.at(-1);
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4" aria-live="polite" aria-label="Conversation">
        {messages.map((m, i) => (
          <li key={i} className={m.role === "user" ? "self-end" : "self-start"}>
            {m.role === "user" ? (
              <p className="max-w-[85vw] rounded-3xl rounded-br-md bg-secondary px-4 py-3 text-secondary-foreground sm:max-w-md">
                {m.text}
              </p>
            ) : (
              <div className="flex max-w-[92vw] animate-card-in flex-col gap-3 rounded-3xl rounded-bl-md border bg-card p-4 sm:max-w-xl">
                <div className="flex items-start gap-2">
                  <p className="reading-block flex-1 whitespace-pre-line">{m.text}</p>
                  <SpeakButton text={[m.text, m.check].filter(Boolean).join(" ")} />
                </div>
                {m.check ? (
                  <p className="rounded-2xl bg-accent px-3 py-2 font-semibold text-accent-foreground">{m.check}</p>
                ) : null}
                {m.citations?.length ? (
                  <ul className="flex flex-col">
                    {m.citations.map((c, j) => (
                      <li key={j}>
                        <Link
                          href={`/documents/${c.documentId}/page/${c.page}`}
                          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                        >
                          <BookOpen className="size-4" aria-hidden="true" /> {c.title}, p. {c.page}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </li>
        ))}
        {pending ? (
          <li className="self-start rounded-3xl border bg-card px-4 py-3 text-muted-foreground" aria-busy="true">
            <span className="animate-calm-pulse">Je cherche dans tes cours…</span>
          </li>
        ) : null}
      </ol>
      <div ref={endRef} />
      {error ? (
        <p role="alert" className="rounded-2xl bg-warning-soft px-4 py-3">
          {error}
        </p>
      ) : null}
      {last?.role === "assistant" && !pending ? (
        <div className="flex flex-wrap gap-2" aria-label="Relances">
          <Button variant="outline" onClick={() => send("simpler", "Plus simple")}>
            Plus simple
          </Button>
          <Button variant="outline" onClick={() => send("example", "Un autre exemple")}>
            Un autre exemple
          </Button>
          <Button variant="outline" onClick={() => send("quiz", "Interroge-moi")}>
            Interroge-moi
          </Button>
        </div>
      ) : null}
      <form
        className="sticky bottom-20 flex items-end gap-2 rounded-3xl border bg-card p-2 md:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            send("ask", draft.trim());
            setDraft("");
          }
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Ta question
        </label>
        <Textarea
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={notionTitle ? `Une question sur « ${notionTitle} » ?` : "Pose ta question sur tes cours…"}
          className="min-h-12 flex-1 resize-none border-0 bg-transparent"
          rows={1}
          maxLength={1000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button type="submit" size="icon" disabled={pending || !draft.trim()} aria-label="Envoyer">
          <Send aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
