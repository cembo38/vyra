"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inspreken i.p.v. typen — gebruikt de Web Speech API van de browser, dus
 * geen aparte AI-sleutel of server-aanroep nodig. Werkt op laptop én
 * telefoon in Chrome (Windows/Mac/Android) en in Safari vanaf iOS/macOS
 * 16.4. In browsers zonder ondersteuning (met name Firefox) verschijnt de
 * knop simpelweg niet, in plaats van een kapotte knop te tonen.
 *
 * De browser vraagt bij de eerste keer om microfoontoegang — dat is
 * standaard browsergedrag, hier niet apart af te vangen of te omzeilen.
 *
 * Indrukken-en-vasthouden i.p.v. tikken-om-te-starten/tikken-om-te-stoppen
 * (zoals een spraakbericht in WhatsApp): dat maakt volstrekt ondubbelzinnig
 * wanneer er wordt opgenomen — loslaten stopt altijd, er bestaat geen "sta
 * ik nu nog aan te luisteren?"-onzekerheid meer. Tijdens het vasthouden is
 * dat bovendien overduidelijk te zien: een pulserende rode ring, een
 * animerende geluidsgolf i.p.v. het statische icoon, en een "Luistert…"-
 * label — plus een korte pieptoon bij starten (hoog) en loslaten (laag),
 * gesynthetiseerd via de Web Audio API zodat er geen los geluidsbestand
 * nodig is.
 */

interface SpeechRecognitionResultLike {
  transcript: string;
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Ondersteuning verandert nooit tijdens de levensduur van de pagina, dus een
// no-op subscribe volstaat — useSyncExternalStore geeft hier alleen een
// SSR-veilige manier om "false" op de server en het echte antwoord op de
// client te retourneren, zonder een setState-in-effect te hoeven doen.
function subscribe() {
  return () => {};
}
function getSnapshot() {
  return getSpeechRecognitionConstructor() !== null;
}
function getServerSnapshot() {
  return false;
}

// Eén gedeelde AudioContext voor de hele pagina (i.p.v. per knop) — browsers
// beperken het aantal gelijktijdige contexts, en het geluid hoeft toch nooit
// door meerdere knoppen tegelijk afgespeeld te worden.
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext) sharedAudioContext = new Ctor();
  // Sommige browsers starten een AudioContext geschorst totdat er een
  // gebruikersinteractie is geweest — pointerdown/keydown telt daarvoor,
  // maar we hervatten 'm hier expliciet voor de zekerheid.
  if (sharedAudioContext.state === "suspended") void sharedAudioContext.resume();
  return sharedAudioContext;
}

/** Korte, zachte pieptoon — geen los geluidsbestand nodig. */
function playBeep(frequencyHz: number, durationMs: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequencyHz;
  const now = ctx.currentTime;
  const durationS = durationMs / 1000;
  // Korte fade-in/-out i.p.v. een harde aan/uit-sprong — anders hoor je een
  // hoorbare "tik" aan het begin/einde van de toon.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationS);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + durationS + 0.02);
}

export function VoiceInputButton({ onTranscript, className }: { onTranscript: (text: string) => void; className?: string }) {
  const supported = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  // Ref i.p.v. de `listening`-state: deze wordt gelezen in event-handlers
  // die éénmalig (bij het aanmaken van de recognition) zijn vastgelegd, en
  // een ref blijft — anders dan een uit de sluiting meegekregen state-
  // waarde — altijd actueel.
  const holdingRef = useRef(false);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  useEffect(() => {
    if (!supported) return;
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = "nl-NL";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) onTranscriptRef.current(transcript);
    };
    recognition.onerror = () => {
      holdingRef.current = false;
      setListening(false);
    };
    recognition.onend = () => {
      // De browser stopt vanzelf na een korte stilte, ook als de knop nog
      // ingedrukt wordt gehouden — meteen herstarten zodat "vasthouden =
      // luisteren" ook echt klopt bij een zin met een pauze erin. Elke
      // herstart levert zijn eigen (nieuwe) transcript op, dus dit plakt
      // niets dubbel — precies zoals meerdere keren kort achter elkaar
      // inspreken dat ook al deed.
      if (holdingRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // Val door naar het gewone stop-gedrag hieronder.
        }
      }
      setListening(false);
    };
    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    };
  }, [supported]);

  if (!supported) return null;

  function startListening() {
    if (holdingRef.current) return;
    const recognition = recognitionRef.current;
    if (!recognition) return;
    holdingRef.current = true;
    try {
      recognition.start();
      setListening(true);
      playBeep(880, 100);
    } catch {
      // Al bezig met luisteren, of microfoon geweigerd — negeren, de knop
      // blijft gewoon klikbaar voor een nieuwe poging.
      holdingRef.current = false;
    }
  }

  function stopListening() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
    playBeep(520, 120);
  }

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        startListening();
      }}
      onPointerUp={stopListening}
      onPointerCancel={stopListening}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          startListening();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          stopListening();
        }
      }}
      onBlur={stopListening}
      aria-label={listening ? "Aan het luisteren — loslaten om te stoppen" : "Houd ingedrukt om in te spreken"}
      title={listening ? "Loslaten om te stoppen" : "Houd ingedrukt om in te spreken"}
      aria-pressed={listening}
      className={cn(
        "icon-pop relative flex shrink-0 touch-none select-none items-center justify-center rounded-full transition-colors duration-[var(--duration-swift)]",
        listening ? "bg-danger text-white" : "bg-paper-dim text-ink-faint hover:text-ink",
        className
      )}
    >
      {listening && (
        <>
          {/* Uitdijende, wegvagende ringen — het "je bent nu live"-signaal. */}
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-danger/60" />
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-danger/40 [animation-delay:300ms]" />
          {/* Ondubbelzinnig tekstlabel — de animatie alleen bleek voor Cem
              niet duidelijk genoeg te zien dat er daadwerkelijk wordt
              opgenomen. */}
          <span
            aria-hidden
            className="absolute bottom-full left-1/2 z-20 mb-2 flex -translate-x-1/2 animate-rise items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-paper shadow-[var(--shadow-pop)]"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-danger" />
            Luistert…
          </span>
        </>
      )}
      {listening ? (
        <span aria-hidden className="relative flex h-3.5 items-center justify-center gap-[3px]">
          <span className="h-2 w-[3px] animate-mic-wave rounded-full bg-white [animation-delay:-0.4s]" />
          <span className="h-3.5 w-[3px] animate-mic-wave rounded-full bg-white [animation-delay:-0.2s]" />
          <span className="h-2.5 w-[3px] animate-mic-wave rounded-full bg-white" />
        </span>
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}
