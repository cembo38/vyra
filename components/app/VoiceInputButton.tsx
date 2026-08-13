"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";
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

export function VoiceInputButton({ onTranscript, className }: { onTranscript: (text: string) => void; className?: string }) {
  const supported = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);

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
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    };
  }, [supported]);

  if (!supported) return null;

  function toggle() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
      return;
    }
    try {
      recognition.start();
      setListening(true);
    } catch {
      // Al bezig met luisteren, of microfoon geweigerd — negeren, de knop
      // blijft gewoon klikbaar voor een nieuwe poging.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Stop met inspreken" : "Inspreken"}
      title={listening ? "Stop met inspreken" : "Inspreken"}
      className={cn(
        "icon-pop flex shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--duration-swift)]",
        listening ? "bg-danger text-white" : "bg-paper-dim text-ink-faint hover:text-ink",
        className
      )}
    >
      {listening ? <Square className="size-3 fill-current" /> : <Mic className="size-4" />}
    </button>
  );
}
