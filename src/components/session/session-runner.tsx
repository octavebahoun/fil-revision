"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Focus, Lightbulb, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FicheView } from "@/components/cards/fiche-view";
import { SourceLink } from "@/components/cards/source-link";
import { ProgressBar } from "@/components/common/progress-bar";
import { useAnnounce } from "@/components/providers/announcer";
import { useSettingsOptional } from "@/components/providers/settings-provider";
import { FlashcardItem } from "./flashcard-item";
import { QuizItem, type QuizResult } from "./quiz-item";
import { ResumeBanner } from "./resume-banner";
import { ParkingInput } from "./parking-input";
import { Celebration } from "./celebration";
import { ReadingRuler } from "./reading-ruler";
import { FicheContent } from "@/lib/content/schemas";
import { localDb, type LocalSession } from "@/lib/offline/db";
import { enqueue, startOutbox } from "@/lib/offline/outbox";
import type { SessionCard } from "@/lib/review/sessions";

const IDLE_MS = 45_000;
const ABSENCE_WINDOW_MS = 120_000;

type Props = {
  session: Omit<LocalSession, "cards" | "answers" | "stats" | "lastActiveAt" | "updatedAt"> & {
    status: "active" | "done";
  };
  cards: SessionCard[];
};

function uuid() {
  return crypto.randomUUID();
}

function reminderOf(card: SessionCard | undefined): string {
  if (!card) return "";
  const c = card.content;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const text = s(c.front) || s(c.question) || s(c.statement) || s(c.explanation) || s(c.en);
  return text.length > 90 ? `${text.slice(0, 88)}…` : text;
}

export function SessionRunner({ session, cards }: Props) {
  const announce = useAnnounce();
  const settings = useSettingsOptional();
  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const items = session.items;

  const [local, setLocal] = useState<LocalSession | null>(null);
  const [phase, setPhase] = useState<"question" | "feedback">("question");
  const [feedback, setFeedback] = useState<(QuizResult & { explanation: string }) | null>(null);
  const [banner, setBanner] = useState(false);
  const [parking, setParking] = useState(false);
  const [focus, setFocus] = useState(false);
  const [ficheOpen, setFicheOpen] = useState<string | null>(null);
  const lastInput = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // --- Chargement : IndexedDB d'abord (le plus récent), sinon l'état serveur ---------------
  useEffect(() => {
    startOutbox();
    let cancelled = false;
    (async () => {
      const now = new Date().toISOString();
      const fresh: LocalSession = {
        ...session,
        cards,
        answers: {},
        stats: { answered: 0, correct: 0, decroches: 0 },
        lastActiveAt: now,
        updatedAt: now,
      };
      let saved: LocalSession | undefined;
      try {
        saved = await (await localDb()).get("sessions", session.id);
      } catch {
        /* IndexedDB indisponible : on continue avec l'état serveur */
      }
      const state =
        saved && saved.position >= session.position
          ? { ...saved, cards }
          : {
              ...fresh,
              position: Math.max(session.position, saved?.position ?? 0),
              answers: saved?.answers ?? {},
              stats: saved?.stats ?? fresh.stats,
            };
      if (cancelled) return;
      setLocal(state);
      // On revient dans une session déjà commencée : on aide à se raccrocher.
      if (state.position > 0 && state.status === "active") setBanner(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, cards]);

  // --- Sauvegarde immédiate de chaque changement -------------------------------------------
  const persist = useCallback((next: LocalSession) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setLocal(stamped);
    void localDb()
      .then((db) => db.put("sessions", stamped))
      .catch(() => {});
  }, []);

  const position = local?.position ?? session.position;
  const done = local ? local.position >= items.length || local.status === "done" : false;
  const item = items[Math.min(position, items.length - 1)];
  const card = item ? cardsById.get(item.cardId) : undefined;

  const goTo = useCallback(
    (state: LocalSession, nextPos: number) => {
      const next = { ...state, position: nextPos, lastActiveAt: new Date().toISOString() };
      setPhase("question");
      setFeedback(null);
      if (nextPos >= items.length) {
        next.status = "done";
        persist(next);
        void enqueue({
          kind: "position",
          id: uuid(),
          sessionId: session.id,
          position: nextPos,
          at: new Date().toISOString(),
        });
        void enqueue({
          kind: "session_end",
          id: uuid(),
          sessionId: session.id,
          stats: next.stats,
          at: new Date().toISOString(),
        });
        announce("Session terminée. Bravo !", "success");
        return;
      }
      persist(next);
      void enqueue({
        kind: "position",
        id: uuid(),
        sessionId: session.id,
        position: nextPos,
        at: new Date().toISOString(),
      });
      requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
    },
    [announce, items.length, persist, session.id],
  );

  const record = useCallback(
    (
      state: LocalSession,
      cardId: string,
      r: { outcome: "rated" | "absent"; rating: number | null; correct: boolean | null; answer?: unknown },
    ) => {
      const id = uuid();
      const at = new Date().toISOString();
      void enqueue({
        kind: "review",
        id,
        cardId,
        sessionId: session.id,
        outcome: r.outcome,
        rating: r.rating,
        correct: r.correct,
        answer: r.answer,
        at,
      });
      const answered = r.outcome === "rated" ? state.stats.answered + 1 : state.stats.answered;
      const correct =
        r.outcome === "rated" && (r.correct === true || (r.rating ?? 0) >= 3)
          ? state.stats.correct + 1
          : state.stats.correct;
      return {
        ...state,
        answers: {
          ...state.answers,
          [cardId]: { reviewId: id, rating: r.rating, correct: r.correct, at, outcome: r.outcome },
        },
        stats: { ...state.stats, answered, correct },
      } satisfies LocalSession;
    },
    [session.id],
  );

  // --- Actions -----------------------------------------------------------------------------
  const onRate = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
      if (!local || !card) return;
      const next = record(local, card.id, { outcome: "rated", rating, correct: rating >= 3 });
      goTo(next, local.position + 1);
    },
    [card, goTo, local, record],
  );

  const onAbsent = useCallback(() => {
    if (!local || !card) return;
    // Aucune note : FSRS n'est pas touché, la carte reviendra plus tard.
    const next = record(local, card.id, { outcome: "absent", rating: null, correct: null });
    announce("Pas de souci. Cette carte reviendra plus tard, sans pénalité.");
    goTo(next, local.position + 1);
  }, [announce, card, goTo, local, record]);

  const onQuiz = useCallback(
    (r: QuizResult) => {
      if (!local || !card) return;
      const next = record(local, card.id, {
        outcome: "rated",
        rating: r.correct ? 3 : 1,
        correct: r.correct,
        answer: r.answer,
      });
      persist(next);
      setFeedback({ ...r, explanation: typeof card.content.explanation === "string" ? card.content.explanation : "" });
      setPhase("feedback");
      announce(r.correct ? "Juste !" : "Pas tout à fait. Voici l'explication.");
    },
    [announce, card, local, persist, record],
  );

  const onFicheRead = useCallback(() => {
    if (!local || !card) return;
    const next = record(local, card.id, { outcome: "rated", rating: 3, correct: true });
    goTo(next, local.position + 1);
  }, [card, goTo, local, record]);

  /**
   * « J'ai décroché » : réaffiche l'élément précédent. Les erreurs des 2 dernières minutes
   * (probablement faites pendant l'absence) sont annulées et ne comptent pas.
   */
  const onDecroche = useCallback(() => {
    if (!local) return;
    const now = Date.now();
    const answers = { ...local.answers };
    let { answered } = local.stats;
    const { correct } = local.stats;
    for (const [cardId, a] of Object.entries(local.answers)) {
      const recent = now - new Date(a.at).getTime() < ABSENCE_WINDOW_MS;
      const wrong = a.outcome === "rated" && (a.correct === false || (a.rating ?? 3) <= 1);
      if (recent && wrong) {
        void enqueue({ kind: "undo", id: uuid(), reviewId: a.reviewId, at: new Date().toISOString() });
        delete answers[cardId];
        answered = Math.max(0, answered - 1);
      }
    }
    void enqueue({
      kind: "session_event",
      id: uuid(),
      sessionId: session.id,
      type: "decroche",
      cardId: card?.id ?? null,
      at: new Date().toISOString(),
    });
    const target = Math.max(0, Math.min(local.position, items.length) - 1);
    const next: LocalSession = {
      ...local,
      answers,
      stats: { answered, correct, decroches: local.stats.decroches + 1 },
      status: "active",
    };
    announce("Pas de souci. On reprend juste avant, rien n'est compté comme une erreur.");
    goTo(next, target);
  }, [announce, card?.id, goTo, items.length, local, session.id]);

  const resume = useCallback(() => {
    setBanner(false);
    lastInput.current = Date.now();
    void enqueue({
      kind: "session_event",
      id: uuid(),
      sessionId: session.id,
      type: "reprise",
      cardId: card?.id ?? null,
      at: new Date().toISOString(),
    });
    requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  }, [card?.id, session.id]);

  const toggleFocus = useCallback(() => setFocus((f) => !f), []);

  useEffect(() => {
    document.documentElement.setAttribute("data-focus-mode", String(focus));
    return () => document.documentElement.removeAttribute("data-focus-mode");
  }, [focus]);

  // --- Inactivité (45 s), retour sur l'onglet, raccourcis ----------------------------------
  useEffect(() => {
    if (done) return;
    if (lastInput.current === 0) lastInput.current = Date.now();
    const bump = () => {
      lastInput.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    for (const e of events) window.addEventListener(e, bump, { passive: true });
    const timer = setInterval(() => {
      if (!banner && !parking && Date.now() - lastInput.current > IDLE_MS) setBanner(true);
    }, 2000);
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > 1500) setBanner(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      for (const e of events) window.removeEventListener(e, bump);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [banner, done, parking]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (banner || parking || ficheOpen) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "d") {
        e.preventDefault();
        onDecroche();
      } else if (k === "f") {
        e.preventDefault();
        toggleFocus();
      } else if (k === "n") {
        e.preventDefault();
        setParking(true);
      } else if (phase === "feedback" && (e.key === "Enter" || e.code === "Space") && local) {
        e.preventDefault();
        goTo(local, local.position + 1);
      } else if (card?.type === "fiche" && local) {
        if (e.key === "ArrowRight" || e.key === "Enter") {
          e.preventDefault();
          onFicheRead();
        } else if (e.key === "ArrowLeft" && local.position > 0) {
          e.preventDefault();
          goTo(local, local.position - 1);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [banner, card?.type, ficheOpen, goTo, local, onDecroche, onFicheRead, parking, phase, toggleFocus]);

  // Balayage horizontal pour les fiches (mobile).
  const touchX = useRef<number | null>(null);

  if (!local) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-3 w-full animate-calm-pulse rounded-full bg-muted" />
        <div className="h-72 w-full animate-calm-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (done) {
    return <SessionDone stats={local.stats} total={items.length} />;
  }

  const ficheForCard = card?.ficheId && card.ficheId !== card.id ? cardsById.get(card.ficheId) : undefined;
  const fiche = card?.type === "fiche" ? FicheContent.safeParse(card.content) : null;
  const progressLabel = `${Math.min(position + 1, items.length)}/${items.length}`;

  return (
    <div className="flex flex-col gap-5">
      {settings?.settings.readingRuler ? <ReadingRuler /> : null}
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-semibold" aria-live="polite">
            {progressLabel}
            <span className="sr-only"> : {card?.notionTitle}</span>
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFocus}
              aria-pressed={focus}
              aria-label="Mode focus (F)"
              aria-keyshortcuts="F"
            >
              <Focus aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Quitter (ta place est gardée)">
              <Link href="/">
                <X aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
        <ProgressBar value={position} max={items.length} label="Progression de la session" />
      </header>

      <div
        ref={mainRef}
        tabIndex={-1}
        key={`${position}-${phase}`}
        className="animate-card-in outline-none"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (card?.type !== "fiche" || touchX.current === null) return;
          const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
          if (dx < -70) onFicheRead();
          else if (dx > 70 && local.position > 0) goTo(local, local.position - 1);
          touchX.current = null;
        }}
      >
        {!card ? (
          <p className="rounded-2xl bg-info-soft p-4">Cette carte n&apos;existe plus. On passe à la suite.</p>
        ) : card.type === "fiche" && fiche?.success ? (
          <div className="flex flex-col gap-4">
            <FicheView
              fiche={fiche.data}
              footer={<SourceLink documentId={card.documentId} pages={card.sourcePages} title={card.documentTitle} />}
            />
            <Button size="lg" onClick={onFicheRead} aria-keyshortcuts="ArrowRight Enter">
              J&apos;ai compris, suivant
            </Button>
            <Link
              href={`/tuteur?notion=${card.notionId}&simple=1`}
              className="min-h-11 content-center self-center text-base text-primary"
            >
              Je ne comprends pas
            </Link>
          </div>
        ) : ["flashcard", "vocab", "phrase"].includes(card.type) ? (
          <FlashcardItem key={card.id} type={card.type} content={card.content} onRate={onRate} onAbsent={onAbsent} />
        ) : phase === "question" ? (
          <QuizItem key={card.id} id={card.id} type={card.type} content={card.content} onAnswer={onQuiz} />
        ) : feedback ? (
          <div className="flex flex-col gap-4" role="status">
            <div
              className={`flex flex-col gap-2 rounded-3xl p-5 ${feedback.correct ? "bg-success-soft" : "bg-warning-soft"}`}
            >
              <p className="text-xl font-bold">{feedback.correct ? "Juste !" : "Pas tout à fait."}</p>
              {!feedback.correct ? (
                <p>
                  <span className="font-semibold">La réponse : </span>
                  {feedback.expected}
                </p>
              ) : null}
              {feedback.explanation ? <p className="reading-block">{feedback.explanation}</p> : null}
            </div>
            <Button size="lg" onClick={() => goTo(local, local.position + 1)} aria-keyshortcuts="Enter">
              Continuer
            </Button>
            {ficheForCard ? (
              <Button variant="ghost" className="self-center" onClick={() => setFicheOpen(ficheForCard.id)}>
                Revoir la fiche
              </Button>
            ) : null}
            <SourceLink documentId={card.documentId} pages={card.sourcePages} title={card.documentTitle} />
          </div>
        ) : null}
      </div>

      {parking ? (
        <ParkingInput
          onClose={() => setParking(false)}
          onSave={(text) => {
            void enqueue({ kind: "parking", id: uuid(), sessionId: session.id, text, at: new Date().toISOString() });
            announce("Idée gardée. Tu la retrouves dans « Pensées notées ».", "success");
          }}
        />
      ) : null}

      {/* Toujours visible en session, à portée de pouce */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-2 flex items-center justify-between gap-2 border-t bg-background/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
        <Button variant="outline" onClick={onDecroche} aria-keyshortcuts="D">
          <RotateCcw aria-hidden="true" /> J&apos;ai décroché
        </Button>
        <Button variant="ghost" onClick={() => setParking((p) => !p)} aria-keyshortcuts="N" aria-expanded={parking}>
          <Lightbulb aria-hidden="true" /> Noter une idée
        </Button>
      </div>

      {banner ? (
        <ResumeBanner
          title={card?.notionTitle ?? "Ta session"}
          reminder={reminderOf(card)}
          progress={progressLabel}
          onResume={resume}
        />
      ) : null}

      <Dialog open={ficheOpen !== null} onOpenChange={(o) => !o && setFicheOpen(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>La fiche</DialogTitle>
            <DialogDescription>Relis-la tranquillement, puis reprends la session.</DialogDescription>
          </DialogHeader>
          {ficheOpen && cardsById.get(ficheOpen)
            ? (() => {
                const f = FicheContent.safeParse(cardsById.get(ficheOpen)!.content);
                return f.success ? <FicheView fiche={f.data} /> : null;
              })()
            : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionDone({ stats, total }: { stats: LocalSession["stats"]; total: number }) {
  return (
    <section
      className="relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border bg-card px-6 py-10 text-center"
      aria-labelledby="fini"
    >
      <Celebration />
      <h1 id="fini" className="text-3xl font-bold">
        C&apos;est fait !
      </h1>
      <p className="text-lg">
        {stats.answered} réponse{stats.answered > 1 ? "s" : ""} sur {total} éléments
        {stats.answered ? ` · ${stats.correct} juste${stats.correct > 1 ? "s" : ""}` : ""}.
      </p>
      <p className="reading-block rounded-2xl bg-accent px-4 py-3 text-accent-foreground">
        Fais une vraie pause de 5 minutes : lève-toi, bois un verre d&apos;eau, regarde au loin.
      </p>
      <div className="flex w-full flex-col gap-3 sm:w-auto">
        <Button asChild size="lg">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/pensees">Voir mes idées notées</Link>
        </Button>
      </div>
    </section>
  );
}
