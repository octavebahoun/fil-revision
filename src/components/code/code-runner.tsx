"use client";
import { useId, useState, useTransition } from "react";
import { Lightbulb, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CodeExerciseContent } from "@/lib/content/schemas";
import { hasOrderBy, outputsMatch, sqlResultsMatch, type SqlResult } from "@/lib/code/compare";
import { reviewPhpAction } from "@/lib/code/actions";
import { runJs, runSql, transpileTs } from "./runners";

type Verdict = { ok: boolean; message: string; output?: string; table?: SqlResult };

/** Exercice de code : SQL et JS/TS vérifiés dans le navigateur, PHP relu par l'IA. */
export function CodeRunner({
  cardId,
  exercise,
  nonce,
}: {
  cardId: string;
  exercise: CodeExerciseContent;
  nonce: string;
}) {
  const [code, setCode] = useState(exercise.starter || "");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [hints, setHints] = useState(0);
  const [pending, start] = useTransition();
  const id = useId();

  const run = () =>
    start(async () => {
      try {
        if (exercise.language === "sql") {
          const [mine, ref] = await Promise.all([
            runSql(exercise.setup, code),
            runSql(exercise.setup, exercise.solution),
          ]);
          const ok = sqlResultsMatch(mine, ref, hasOrderBy(exercise.solution));
          setVerdict({
            ok,
            table: mine,
            message: ok ? "Juste ! Ton résultat correspond." : "Pas encore : le résultat diffère de celui attendu.",
          });
        } else if (exercise.language === "php") {
          const res = await reviewPhpAction(cardId, code);
          setVerdict(
            res.ok
              ? { ok: res.review.status === "ok", message: res.review.feedback }
              : { ok: false, message: res.message },
          );
        } else {
          const prepare = async (c: string) => (exercise.language === "ts" ? transpileTs(c) : c);
          const [mine, ref] = await Promise.all([
            prepare(code).then((c) => runJs(c, nonce)),
            prepare(exercise.solution).then((c) => runJs(c, nonce)),
          ]);
          const expected = ref.error ? exercise.expectedOutput : ref.lines.join("\n");
          if (mine.error)
            return setVerdict({ ok: false, message: `Erreur : ${mine.error}`, output: mine.lines.join("\n") });
          const ok = outputsMatch(mine.lines.join("\n"), expected);
          setVerdict({
            ok,
            output: mine.lines.join("\n"),
            message: ok ? "Juste ! La sortie correspond." : `Pas encore. Sortie attendue : ${expected}`,
          });
        }
      } catch (err) {
        setVerdict({ ok: false, message: `Erreur : ${err instanceof Error ? err.message : "exécution impossible"}` });
      }
    });

  return (
    <div className="flex flex-col gap-5">
      <p className="reading-block rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground">{exercise.prompt}</p>
      {exercise.language === "sql" && exercise.setup ? (
        <details className="rounded-2xl border bg-card p-3">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Voir les tables</summary>
          <pre className="overflow-x-auto font-mono text-sm whitespace-pre-wrap">{exercise.setup}</pre>
        </details>
      ) : null}
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="font-semibold">
          Ton code ({exercise.language.toUpperCase()})
        </label>
        <textarea
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={10}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !e.shiftKey) {
              e.preventDefault();
              const t = e.currentTarget;
              const { selectionStart: s, selectionEnd: en } = t;
              setCode(code.slice(0, s) + "  " + code.slice(en));
              requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2));
            }
          }}
          className="min-h-48 w-full rounded-2xl border border-input bg-card p-4 font-mono text-sm leading-6"
        />
        <p className="text-sm text-muted-foreground">Tab ajoute deux espaces ; Échap puis Tab pour sortir du champ.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={run} disabled={pending || !code.trim()}>
          <Play aria-hidden="true" /> {exercise.language === "php" ? "Faire relire" : "Exécuter"}
        </Button>
        {hints < exercise.hints.length ? (
          <Button variant="outline" onClick={() => setHints(hints + 1)}>
            <Lightbulb aria-hidden="true" /> {hints ? `Indice ${hints + 1}` : "Un indice"}
          </Button>
        ) : null}
      </div>
      {exercise.hints.slice(0, hints).map((h, i) => (
        <p key={i} className="rounded-2xl bg-accent px-4 py-3 text-accent-foreground">
          <strong>Indice {i + 1} : </strong>
          {h}
        </p>
      ))}
      {verdict ? (
        <section
          aria-live="polite"
          className={`flex flex-col gap-3 rounded-3xl p-5 ${verdict.ok ? "bg-success-soft" : "bg-warning-soft"}`}
        >
          <p className="font-semibold">{verdict.message}</p>
          {verdict.output ? (
            <pre className="overflow-x-auto rounded-xl bg-card p-3 font-mono text-sm">{verdict.output}</pre>
          ) : null}
          {verdict.table ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {verdict.table.columns.map((c) => (
                      <th key={c} scope="col" className="border-b px-2 py-1">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {verdict.table.rows.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      {r.map((v, j) => (
                        <td key={j} className="border-b px-2 py-1">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
