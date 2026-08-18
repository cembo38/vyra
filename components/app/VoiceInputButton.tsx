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
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  // Ref i.p.v. de `listening`-state: deze wordt gelezen in event-handlers
  // die éénmalig (bij het aanmaken van de recognition) zijn vastgelegd, en
  // een ref blijft — anders dan een uit de sluiting meegekregen state-
  // waarde — altijd actueel.
  const holdingRef = useRef(false);
  const gotResultRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  // Foutmelding na een paar seconden vanzelf laten verdwijnen, zodat hij
  // niet voor altijd blijft hangen als iemand het gewoon nog een keer
  // probeert of overschakelt naar typen.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  function clearSafetyTimeout() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

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
      if (transcript) {
        gotResultRef.current = true;
        clearSafetyTimeout();
        setError(null);
        onTranscriptRef.current(transcript);
      }
    };
    recognition.onerror = () => {
      // Sommige browsers (met name mobiele Safari) laten dit event soms
      // ook zonder echte fout afgaan wanneer er simpelweg niets werd
      // gehoord — toon daarom een neutrale, geruststellende melding i.p.v.
      // een harde foutmelding.
      holdingRef.current = false;
      clearSafetyTimeout();
      setListening(false);
      setError("Geen spraak herkend — probeer het nog eens, of typ je antwoord.");
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
      clearSafetyTimeout();
      // Als "luisteren" gewoon eindigde zonder dat er ooit een transcript
      // binnenkwam (en zonder dat `onerror` iets meldde) — dit is precies
      // het stille faalpatroon dat op sommige mobiele browsers optreedt —
      // laat dat dan alsnog duidelijk merken i.p.v. gewoon niets te doen.
      if (listening && !gotResultRef.current) {
        setError("Er is niets opgenomen — controleer of de microfoon is toegestaan, of typ je antwoord.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  if (!supported) return null;

  async function startListening() {
    if (holdingRef.current) return;
    const recognition = recognitionRef.current;
    if (!recognition) return;
    holdingRef.current = true;
    gotResultRef.current = false;
    setError(null);

    // Vraag microfoontoegang eerst expliciet zelf aan i.p.v. te vertrouwen
    // op de interne toestemmingsaanvraag van `SpeechRecognition` — op
    // mobiele Safari bleek die laatste onbetrouwbaar: soms verschijnt er
    // helemaal geen toestemmingsprompt en start `recognition.start()`
    // vervolgens stilzwijgend niets op (geen opname, geen fout, geen
    // transcript — precies het gemelde probleem). Deze expliciete aanvraag
    // dwingt de browser-eigen prompt af en geeft ons een harde fout te
    // pakken als toegang geweigerd is.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Alleen nodig om de toestemming te forceren/bevestigen —
        // `SpeechRecognition` beheert zijn eigen audio-opname apart, dus
        // deze losse stream meteen weer sluiten.
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        holdingRef.current = false;
        setError("Geen toegang tot de microfoon — controleer microfoontoestemming voor deze site in je browser-/telefooninstellingen.");
        return;
      }
    }
    // De knop kan intussen (tijdens het wachten op de toestemmingsprompt)
    // alweer losgelaten zijn — dan niet alsnog beginnen met luisteren.
    if (!holdingRef.current) return;

    try {
      recognition.start();
      setListening(true);
      playBeep(880, 100);
      // Vangnet: als er na 10 seconden nog steeds niets is gebeurd (geen
      // resultaat, geen fout, geen einde), forceer dan een duidelijke
      // melding i.p.v. de gebruiker met een stille, "vastzittende" knop
      // achter te laten.
      clearSafetyTimeout();
      timeoutRef.current = setTimeout(() => {
        if (holdingRef.current && !gotResultRef.current) {
          holdingRef.current = false;
          recognition.stop();
          setListening(false);
          setError("Spraakherkenning reageert niet — typ je antwoord, of probeer het later opnieuw.");
        }
      }, 10000);
    } catch {
      // Al bezig met luisteren, of microfoon geweigerd — duidelijk melden
      // i.p.v. stilzwijgend niets te doen.
      holdingRef.current = false;
      setError("Kon spraakherkenning niet starten — typ je antwoord, of probeer het opnieuw.");
    }
  }

  function stopListening() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    clearSafetyTimeout();
    recognitionRef.current?.stop();
    setListening(false);
    playBeep(520, 120);
  }

  return (
    <span className="relative inline-flex">
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
    {error && !listening && (
      <span
        role="alert"
        className="absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[14rem] -translate-x-1/2 rounded-xl bg-danger px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-white shadow-[var(--shadow-pop)]"
      >
        {error}
      </span>
    )}
    </span>
  );
}
