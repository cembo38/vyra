"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Sparkles, ArrowUp, Loader2, AlertTriangle } from "lucide-react";
import { startInterviewAction, continueInterviewAction, generatePlanPreviewAction, generatePlanAction } from "@/lib/actions/event-actions";
import { VoiceInputButton } from "@/components/app/VoiceInputButton";
import { AiTag, PriorityBadge } from "@/components/ui/Badge";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
import { MAX_INTERVIEW_QUESTIONS } from "@/lib/config";
import { RequirementCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

/**
 * Next.js implementeert redirect() door een speciale fout te gooien
 * ("NEXT_REDIRECT"), die de framework-laag onderschept om te navigeren.
 * Als een server action (bv. bij een verlopen sessie, of na afronden van
 * het plan) intern redirect() aanroept, en wij die aanroep hier client-
 * side in een generieke try/catch afvangen, zouden we die navigatie per
 * ongeluk kunnen inslikken en in plaats daarvan onterecht een "AI
 * reageert niet"-foutmelding tonen. Deze check zorgt dat we zo'n fout
 * altijd doorgooien, zodat Next.js de navigatie gewoon kan afhandelen.
 */
function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

const STARTERS = [
  "Ik wil in juni een luxe bruiloft organiseren voor ongeveer 120 mensen in Amsterdam.",
  "Ik wil thuis een groot verjaardagsfeest geven voor mijn 40e verjaardag.",
  "Ik wil een kerstborrel voor mijn bedrijf organiseren voor 80 medewerkers.",
];

export function NewEventInterview() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: "Wat wil je organiseren?" }]);
  const [input, setInput] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  // Vooraf al laten zien welke categorieën de AI voorstelt, i.p.v. dat de
  // organisator eerst blind op "Bekijk mijn AI-eventplan" moet klikken —
  // zie de toelichting bij generatePlanPreviewAction() in event-actions.ts.
  // `null` = nog niet (geprobeerd te) laden, `[]` = geladen maar de AI
  // stelde (zeldzaam) geen enkele categorie voor.
  const [previewCategories, setPreviewCategories] = useState<RequirementCategory[] | null>(null);

  // Spec-item #56 ("er komt maar geen einde aan de vragen"): tel hoeveel
  // écht gestelde interviewvragen er tot nu toe zijn, zodat we de
  // organisator vooraf én lopend inzicht kunnen geven in hoeveel vragen er
  // nog volgen. De statische openingszin ("Wat wil je organiseren?") staat
  // hierboven hardcoded in de initiële state en is geen AI-gegenereerde
  // vraag, dus die trekken we af. Zodra het interview klaar is ("done")
  // bevat de laatste assistant-tekst geen vraag meer maar de afsluitzin
  // ("Dank je, ik heb genoeg…" — zie startInterviewAction/
  // continueInterviewAction), dus die tellen we ook niet mee.
  const assistantMessageCount = messages.filter((m) => m.role === "assistant").length;
  const askedCount = Math.max(0, assistantMessageCount - 1 - (done ? 1 : 0));

  function scrollDown() {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending || done) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    scrollDown();

    startTransition(async () => {
      try {
        if (!eventId) {
          const res = await startInterviewAction(trimmed);
          setEventId(res.eventId);
          setMessages((m) => [...m, { role: "assistant", text: res.assistantMessage }]);
          setDone(res.done);
        } else {
          const res = await continueInterviewAction(eventId, trimmed);
          setMessages((m) => [...m, { role: "assistant", text: res.assistantMessage }]);
          setDone(res.done);
        }
        scrollDown();
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setError("Onze AI reageert nu niet. Probeer het nog eens — je antwoorden blijven bewaard.");
      }
    });
  }

  // `useCallback` met een lege dependency-array: alles wat deze functie
  // aanraakt (startTransition, de server action, de setters) heeft een
  // stabiele identiteit, dus deze functie zelf kan veilig in de
  // dependency-array van het effect hieronder staan zonder dat het effect
  // bij elke render opnieuw afgaat.
  const loadPreview = useCallback((id: string) => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await generatePlanPreviewAction(id);
        setPreviewCategories(res.categories);
        scrollDown();
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setError("Het opstellen van je planvoorstel lukte niet.");
      }
    });
  }, []);

  // Zodra het interview klaar is, meteen — zonder extra klik — de lichte
  // categorievoorproef ophalen (zie loadPreview hierboven). Alleen als er
  // nog geen voorproef is EN er niet al één onderweg is (`pending`),
  // anders zou elke re-render tijdens het laden een nieuwe aanroep
  // starten.
  useEffect(() => {
    if (done && eventId && previewCategories === null && !pending) loadPreview(eventId);
  }, [done, eventId, previewCategories, pending, loadPreview]);

  function goToFullPlan() {
    if (!eventId) return;
    startTransition(async () => {
      try {
        await generatePlanAction(eventId);
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setError("Het genereren van je volledige plan lukte niet. Probeer het nog eens.");
      }
    });
  }

  return (
    // `min-h-dvh` i.p.v. `100vh`: op mobiele Safari/Chrome verandert de
    // adresbalk-hoogte tijdens het scrollen, waardoor `100vh` een sprong
    // in de layout veroorzaakte. `dvh` (dynamic viewport height) volgt dat.
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-sage-50 text-sage">
          <Sparkles className="size-4.5" />
        </div>
        <div>
          <p className="font-display text-lg text-ink">AI Event Interview</p>
          <p className="text-xs text-ink-faint">
            {done
              ? "Klaar — ik heb genoeg om een eerste plan te maken."
              : askedCount === 0
                ? `Vertel me over je evenement — ik stel meestal 4 tot 5 gerichte vervolgvragen, nooit meer dan ${MAX_INTERVIEW_QUESTIONS}.`
                : `Vraag ${askedCount} van maximaal ${MAX_INTERVIEW_QUESTIONS}.`}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto pb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] animate-fade-in rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
              m.role === "assistant" ? "rounded-tl-sm bg-white border border-line-soft text-ink" : "ml-auto rounded-tr-sm bg-ink text-paper"
            )}
          >
            {m.text}
          </div>
        ))}
        {pending && !done && (
          <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-tl-sm border border-line-soft bg-white px-4 py-3 text-ink-faint">
            <Loader2 className="size-4 animate-spin" /> Even denken…
          </div>
        )}

        {/* De voorproef verschijnt automatisch zodra generatePlanPreviewAction
            klaar is (zie het effect hierboven) — geen extra klik nodig. Dit
            is precies wat Cem vroeg na het bekijken van het marketing-
            voorstel: eerst zien wat de AI voorstelt, dan pas bewust naar het
            volledige plan (met conceptberichten/tijdlijn/risico's). */}
        {done && pending && previewCategories === null && (
          <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-tl-sm border border-line-soft bg-white px-4 py-3 text-ink-faint">
            <Loader2 className="size-4 animate-spin" /> Je plan wordt opgesteld…
          </div>
        )}
        {previewCategories && previewCategories.length > 0 && (
          <div className="animate-fade-in rounded-2xl border border-line-soft bg-paper p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-1.5">
              <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-ink-faint">Jouw AI-eventplan</span>
              <AiTag />
            </div>
            <div className="space-y-2">
              {previewCategories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
                  <span className="text-ink">{c.label}</span>
                  <PriorityBadge priority={c.priority} />
                </div>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length === 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="chip-hover rounded-full border border-line bg-white px-3.5 py-1.5 text-left text-xs text-ink-soft hover:border-clay/50 hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {/* Sticky + safe-area-opvulling: blijft altijd bereikbaar boven de
          systeem-thuisbalk op iPhone, ook als de berichtenlijst hierboven
          zijn eigen scroll heeft. */}
      <div className="sticky bottom-0 bg-paper pb-[max(var(--safe-b),0.75rem)] pt-1">
        {done ? (
          previewCategories === null ? (
            // Voorproef laadt (of mislukte en wacht op een herhaalde poging
            // — pending is dan weer false, dus de knop wordt weer klikbaar
            // i.p.v. voor altijd "Even denken" te blijven tonen).
            <button
              onClick={() => eventId && loadPreview(eventId)}
              disabled={pending}
              className="lift-hover inline-flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-6 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-clay-dark disabled:opacity-60 disabled:pointer-events-none"
            >
              {pending ? <VyraMarkSpinner className="text-base" /> : <Sparkles className="size-4" />}
              {pending ? "Je plan wordt opgesteld…" : "Opnieuw proberen"}
            </button>
          ) : (
            <button
              onClick={goToFullPlan}
              disabled={pending}
              className="lift-hover inline-flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-6 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-clay-dark disabled:opacity-60 disabled:pointer-events-none"
            >
              {pending ? <VyraMarkSpinner className="text-base" /> : <Sparkles className="size-4" />}
              Zie volledige plan
            </button>
          )
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Typ of spreek je antwoord in…"
              className="max-h-32 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-ink-faint"
            />
            <VoiceInputButton
              className="size-11"
              onTranscript={(text) => setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="Versturen"
              className="icon-pop flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowUp className="size-4.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
