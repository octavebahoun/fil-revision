"use client";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpeakButton } from "@/components/cards/speak-button";
import {
  associationCorrect,
  blanksCorrect,
  orderCorrect,
  seededShuffle,
  shortAnswerCorrect,
} from "@/lib/review/answer";

type C = Record<string, unknown>;
export type QuizResult = { correct: boolean; answer: unknown; expected: string };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

/** Une question de quiz. Rien n'est noté tant que tu ne valides pas : l'inactivité ne compte jamais comme une erreur. */
export function QuizItem({
  id,
  type,
  content,
  onAnswer,
}: {
  id: string;
  type: string;
  content: C;
  onAnswer: (r: QuizResult) => void;
}) {
  const qid = useId();
  const question = str(content.question) || str(content.statement);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id={qid} className="text-xl leading-snug font-semibold text-balance">
          {type === "vrai_faux" ? "Vrai ou faux ?" : question}
        </h2>
        <SpeakButton text={question} />
      </div>
      {type === "vrai_faux" ? (
        <TrueFalse statement={str(content.statement)} answer={Boolean(content.answer)} onAnswer={onAnswer} />
      ) : null}
      {type === "qcm" ? (
        <Qcm
          id={id}
          labelledBy={qid}
          choices={arr(content.choices)}
          answerIndex={Number(content.answerIndex)}
          onAnswer={onAnswer}
        />
      ) : null}
      {type === "reponse_courte" ? <Short labelledBy={qid} answers={arr(content.answers)} onAnswer={onAnswer} /> : null}
      {type === "code_trou" ? (
        <CodeBlanks code={str(content.code)} blanks={arr(content.blanks)} onAnswer={onAnswer} />
      ) : null}
      {type === "ordre" ? <Order id={id} items={arr(content.items)} onAnswer={onAnswer} /> : null}
      {type === "association" ? (
        <Association id={id} pairs={(content.pairs as { left: string; right: string }[]) ?? []} onAnswer={onAnswer} />
      ) : null}
    </div>
  );
}

function TrueFalse({
  statement,
  answer,
  onAnswer,
}: {
  statement: string;
  answer: boolean;
  onAnswer: (r: QuizResult) => void;
}) {
  return (
    <>
      <p className="reading-block rounded-2xl bg-secondary px-4 py-3 text-lg text-secondary-foreground">{statement}</p>
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((v) => (
          <Button
            key={String(v)}
            size="lg"
            variant="outline"
            onClick={() => onAnswer({ correct: v === answer, answer: v, expected: answer ? "Vrai" : "Faux" })}
          >
            {v ? "Vrai" : "Faux"}
          </Button>
        ))}
      </div>
    </>
  );
}

function Qcm({
  id,
  labelledBy,
  choices,
  answerIndex,
  onAnswer,
}: {
  id: string;
  labelledBy: string;
  choices: string[];
  answerIndex: number;
  onAnswer: (r: QuizResult) => void;
}) {
  const order = useMemo(
    () =>
      seededShuffle(
        choices.map((_, i) => i),
        id,
      ),
    [choices, id],
  );
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= order.length && !(e.target instanceof HTMLInputElement)) setSelected(order[n - 1]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order]);
  return (
    <>
      <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-3">
        {order.map((i, pos) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={selected === i}
            onClick={() => setSelected(i)}
            className={`flex min-h-14 items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left text-base transition-colors duration-200 ${
              selected === i ? "border-primary bg-secondary" : "border-input bg-card hover:border-primary/50"
            }`}
          >
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
              {pos + 1}
            </span>
            <span>{choices[i]}</span>
          </button>
        ))}
      </div>
      <Button
        size="lg"
        disabled={selected === null}
        onClick={() =>
          selected !== null &&
          onAnswer({ correct: selected === answerIndex, answer: selected, expected: choices[answerIndex] ?? "" })
        }
      >
        Valider
      </Button>
    </>
  );
}

function Short({
  labelledBy,
  answers,
  onAnswer,
}: {
  labelledBy: string;
  answers: string[];
  onAnswer: (r: QuizResult) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim())
          onAnswer({ correct: shortAnswerCorrect(value, answers), answer: value, expected: answers[0] ?? "" });
      }}
    >
      <Input
        aria-labelledby={labelledBy}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        placeholder="Ta réponse"
      />
      <Button type="submit" size="lg" disabled={!value.trim()}>
        Valider
      </Button>
    </form>
  );
}

function CodeBlanks({ code, blanks, onAnswer }: { code: string; blanks: string[]; onAnswer: (r: QuizResult) => void }) {
  const parts = code.split("____");
  const [values, setValues] = useState<string[]>(blanks.map(() => ""));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onAnswer({ correct: blanksCorrect(values, blanks), answer: values, expected: blanks.join(", ") });
      }}
    >
      <pre className="overflow-x-auto rounded-2xl bg-muted p-4 font-mono text-sm leading-8 whitespace-pre-wrap">
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 ? (
              <input
                aria-label={`Trou ${i + 1}`}
                value={values[i]}
                onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))}
                className="mx-1 inline-block h-9 w-28 rounded-lg border-2 border-input bg-card px-2 font-mono text-base"
                autoComplete="off"
                spellCheck={false}
              />
            ) : null}
          </span>
        ))}
      </pre>
      <Button type="submit" size="lg" disabled={values.some((v) => !v.trim())}>
        Valider
      </Button>
    </form>
  );
}

function Order({ id, items, onAnswer }: { id: string; items: string[]; onAnswer: (r: QuizResult) => void }) {
  const [list, setList] = useState(() => seededShuffle(items, id));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setList(next);
  };
  return (
    <>
      <ol className="flex flex-col gap-2" aria-label="Éléments à remettre dans l'ordre">
        {list.map((it, i) => (
          <li key={it} className="flex items-center gap-2 rounded-2xl border bg-card py-1 pr-1 pl-4">
            <span className="w-6 shrink-0 font-bold text-muted-foreground">{i + 1}.</span>
            <span className="flex-1">{it}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Monter « ${it} »`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Descendre « ${it} »`}
              disabled={i === list.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ol>
      <Button
        size="lg"
        onClick={() => onAnswer({ correct: orderCorrect(list, items), answer: list, expected: items.join(" → ") })}
      >
        Valider
      </Button>
    </>
  );
}

function Association({
  id,
  pairs,
  onAnswer,
}: {
  id: string;
  pairs: { left: string; right: string }[];
  onAnswer: (r: QuizResult) => void;
}) {
  const rights = useMemo(
    () =>
      seededShuffle(
        pairs.map((p) => p.right),
        id,
      ),
    [pairs, id],
  );
  const [given, setGiven] = useState<Record<string, string>>({});
  const baseId = useId();
  return (
    <>
      <div className="flex flex-col gap-3">
        {pairs.map((p, i) => (
          <div key={p.left} className="flex flex-col gap-1 rounded-2xl border bg-card p-3">
            <label htmlFor={`${baseId}-${i}`} className="font-semibold">
              {p.left}
            </label>
            <select
              id={`${baseId}-${i}`}
              value={given[p.left] ?? ""}
              onChange={(e) => setGiven({ ...given, [p.left]: e.target.value })}
              className="h-12 rounded-xl border border-input bg-card px-3 text-base text-foreground"
            >
              <option value="">Choisir…</option>
              {rights.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <Button
        size="lg"
        disabled={pairs.some((p) => !given[p.left])}
        onClick={() =>
          onAnswer({
            correct: associationCorrect(given, pairs),
            answer: given,
            expected: pairs.map((p) => `${p.left} → ${p.right}`).join(" · "),
          })
        }
      >
        Valider
      </Button>
    </>
  );
}
