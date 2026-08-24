"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { LinkButton } from "@/components/ui/Button";
import { AiTag, Badge, PriorityBadge } from "@/components/ui/Badge";
import { Sparkles, MoveRight, Star } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

/**
 * "Homepage in beweging" (spec-item, augustus 2026 — voorstel afgestemd met
 * Cem via het "Vyra in Beweging"-voorstel, richtingen 1 & 2 + bonussen A &
 * D). De hero was voorheen volledig statisch buiten één fade-in bij het
 * laden (`animate-rise`); dit bestand voegt vier lagen beweging toe zonder
 * de bestaande inhoud/structuur/responsiveness te wijzigen:
 *  1. Een kinetische kop (het cursieve slotwoord wisselt door).
 *  2. Een "levend" AI-interview-mockup (typt echt, bouwt het plan stap voor
 *     stap op) — richting "Levend Verhaal".
 *  3. Een zachtjes ademende achtergrondgloed + onafhankelijk zwevende
 *     badge-kaartjes + een muisgestuurde kanteling op de mockup-kaart —
 *     richting "Zwevende Laag".
 *  4. Een gloed die de cursor door de hero volgt — bonus D.
 * Moest daarom van een server- naar een client component; er wordt geen
 * server-data opgehaald, dus dat heeft verder geen gevolgen.
 */

const KINETIC_WORDS = ["Simplified.", "Geregeld.", "Gevierd.", "Compleet."];

function KineticHeadlineWord() {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      setSwapping(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % KINETIC_WORDS.length);
        setSwapping(false);
      }, 350);
    }, 2600);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  return (
    <span
      className="inline-block italic text-clay transition-all duration-300 ease-out"
      style={{ opacity: swapping ? 0 : 1, transform: swapping ? "translateY(8px)" : "translateY(0)" }}
    >
      {KINETIC_WORDS[index]}
    </span>
  );
}

/** Simpele "0 → doel"-teloptelling, speelt eenmalig kort na het laden van de pagina. */
function CountUp({ target, decimals = 0, suffix = "" }: { target: number; decimals?: number; suffix?: string }) {
  const reducedMotion = usePrefersReducedMotion();
  const [value, setValue] = useState(reducedMotion ? target : 0);

  useEffect(() => {
    if (reducedMotion) return;
    let raf: number;
    const duration = 900;
    let start: number | null = null;
    const delay = setTimeout(() => {
      function step(ts: number) {
        if (start === null) start = ts;
        const p = Math.min(1, (ts - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(target * eased);
        if (p < 1) raf = requestAnimationFrame(step);
        else setValue(target);
      }
      raf = requestAnimationFrame(step);
    }, 500);
    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion, target]);

  return (
    <span className="tabular-nums">
      {decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString("nl-NL")}
      {suffix}
    </span>
  );
}

const CHAT_LINES = [
  { role: "user" as const, text: "Ik wil in juni een luxe bruiloft organiseren voor ongeveer 120 mensen in Amsterdam." },
  { role: "ai" as const, text: "Wat feestelijk! Wil je een formele of informele sfeer, en heb je al een locatie op het oog?" },
  { role: "user" as const, text: "Formeel diner, met een feestavond erna. Nog geen locatie." },
];
const PLAN_ROWS = [
  { label: "Locatie", priority: "essential" as const },
  { label: "Catering", priority: "essential" as const },
  { label: "Fotografie", priority: "essential" as const },
  { label: "Bloemist", priority: "recommended" as const },
];
const READY_STEP = 3 + PLAN_ROWS.length + 2; // bubble0, typing, bubble1, bubble2, plan-rows...

function AiInterviewCard() {
  const reducedMotion = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  // Speelde eerst automatisch af zodra de kaart in beeld kwam — Cem wees
  // er terecht op dat dit niet overeenkomt met hoe hij de kaart in de
  // praktijk ervaart: daar zie je de opbouw pas NA een bewuste klik (het
  // "open AI-plan"-moment), niet meteen bij het laden/scrollen. Nu start
  // de opbouw pas als bezoeker zelf op de knop klikt.
  const [started, setStarted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 150, damping: 18 });
  const springRotateY = useSpring(rotateY, { stiffness: 150, damping: 18 });

  useEffect(() => {
    // Bij reduced-motion wordt de eindstand meteen gezet vanuit de
    // klik-handler zelf (zie `openPlan` hieronder) i.p.v. hier synchroon in
    // de effect-body — dat laatste triggert dezelfde
    // `react-hooks/set-state-in-effect`-lintregel als de fix in
    // usePrefersReducedMotion.ts hierboven al oploste.
    if (!started || reducedMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 200;
    timers.push(setTimeout(() => setStep(1), t)); // bubble 0
    t += 500;
    timers.push(setTimeout(() => setStep(2), t)); // typing indicator
    t += 1100;
    timers.push(setTimeout(() => setStep(3), t)); // bubble 1 (typing weg)
    t += 700;
    timers.push(setTimeout(() => setStep(4), t)); // bubble 2
    PLAN_ROWS.forEach((_, i) => {
      t += 180;
      timers.push(setTimeout(() => setStep(5 + i), t));
    });
    return () => timers.forEach(clearTimeout);
  }, [started, reducedMotion]);

  function openPlan() {
    setStarted(true);
    if (reducedMotion) setStep(READY_STEP); // meteen de eindstand, geen typ-simulatie
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    rotateY.set(x * 8);
    rotateX.set(-y * 8);
  }
  function handleMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 900 }}
      className="rounded-[28px] border border-line bg-white p-5 [box-shadow:var(--shadow-pop)] sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2 border-b border-line-soft pb-4">
        <div className="flex size-8 items-center justify-center rounded-full bg-sage-50 text-sage">
          <Sparkles className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">AI Event Interview</p>
          <p className="text-xs text-ink-faint">Emma & Lucas&apos; bruiloft</p>
        </div>
      </div>

      {!started ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line-soft bg-paper px-5 py-8 text-center">
          <p className="text-sm text-ink-soft">
            Zie in het echt hoe onze AI van een paar zinnen een compleet eventplan bouwt.
          </p>
          <button
            type="button"
            onClick={openPlan}
            className="icon-pop flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper"
          >
            <Sparkles className="size-4" />
            Open het AI-plan
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {CHAT_LINES.map((line, i) => {
              const revealAt = i === 0 ? 1 : i === 1 ? 3 : 4;
              const isBubbleVisible = step >= revealAt;
              return (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm transition-all duration-450 ease-out ${
                    line.role === "user" ? "rounded-tl-sm bg-paper-dim text-ink" : "ml-auto rounded-tr-sm bg-ink text-paper"
                  }`}
                  style={{ opacity: isBubbleVisible ? 1 : 0, transform: isBubbleVisible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.98)" }}
                >
                  {line.text}
                </div>
              );
            })}
            <div
              className="ml-auto flex w-fit items-center gap-1 rounded-2xl rounded-tr-sm bg-ink px-3.5 py-3 transition-opacity duration-300"
              style={{ opacity: step === 2 ? 1 : 0 }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.25 rounded-full bg-paper opacity-60"
                  style={{ animation: step === 2 ? `typing-dot 1s infinite ease-in-out ${i * 0.15}s` : "none" }}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-line-soft bg-paper p-4">
            {/* flex-wrap + whitespace-nowrap: op de smalste telefoons
                (375px) was er te weinig ruimte naast de AiTag-pil,
                waardoor "Jouw AI-eventplan" lelijk middenin afbrak
                ("JOUW AI-" / "EVENTPLAN"). Valt de pil nu niet meer
                ernaast, dan zakt hij gewoon naar een eigen regel. */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-1.5">
              <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-ink-faint">Jouw AI-eventplan</span>
              <AiTag />
            </div>
            <div className="space-y-2.5">
              {PLAN_ROWS.map((c, i) => {
                const visible = step >= 5 + i;
                return (
                  <div
                    key={c.label}
                    className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm transition-all duration-400 ease-out"
                    style={{ opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(-10px)" }}
                  >
                    <span className="text-ink">{c.label}</span>
                    <PriorityBadge priority={c.priority} />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const glowX = useMotionValue(-999);
  const glowY = useMotionValue(-999);
  const springGlowX = useSpring(glowX, { stiffness: 60, damping: 20 });
  const springGlowY = useSpring(glowY, { stiffness: 60, damping: 20 });
  const glowOpacity = useTransform(springGlowX, (x) => (x < -900 ? 0 : 1));
  // Beide hieronder ALTIJD (onvoorwaardelijk) aanroepen — useTransform is
  // een React Hook, en hooks mogen nooit conditioneel worden aangeroepen
  // (react-hooks/rules-of-hooks). De oorspronkelijke opzet riep deze pas
  // aan binnen de `{!reducedMotion && (...)}`-JSX hieronder, wat precies
  // die regel schond. Nu berekenen we ze altijd, en beslist alleen het
  // wél/niet RENDEREN van de glow-div op `reducedMotion`.
  const glowOffsetX = useTransform(springGlowX, (v) => v - 170);
  const glowOffsetY = useTransform(springGlowY, (v) => v - 170);

  function handleSectionMouseMove(e: React.MouseEvent<HTMLElement>) {
    if (reducedMotion || !sectionRef.current) return;
    const r = sectionRef.current.getBoundingClientRect();
    glowX.set(e.clientX - r.left);
    glowY.set(e.clientY - r.top);
  }
  function handleSectionMouseLeave() {
    glowX.set(-999);
  }

  return (
    <section ref={sectionRef} className="relative overflow-hidden" onMouseMove={handleSectionMouseMove} onMouseLeave={handleSectionMouseLeave}>
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-clay-50 via-sage-50/60 to-transparent blur-3xl motion-breathe" />
      {!reducedMotion && (
        <motion.div
          className="pointer-events-none absolute size-[340px] rounded-full bg-clay-50/70 blur-[70px]"
          style={{ left: 0, top: 0, x: glowOffsetX, y: glowOffsetY, opacity: glowOpacity }}
        />
      )}

      <div className="relative mx-auto grid grid-cols-1 max-w-6xl gap-14 px-6 pb-16 pt-16 md:grid-cols-[1.05fr_0.95fr] md:items-center md:pb-24 md:pt-24">
        <div className="animate-rise">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink-soft shadow-sm">
            <Sparkles className="size-3.5 text-sage" />
            Nieuw: AI plant je hele evenement mee
          </div>
          <h1 className="font-display text-[2.6rem] leading-[1.08] tracking-tight text-ink sm:text-6xl">
            Celebrate.
            <br />
            <KineticHeadlineWord />
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
            Vertel ons wat je wilt organiseren en onze AI ontdekt welke mensen, diensten en producten je nodig hebt —
            van bruiloft tot bedrijfsfeest. Aanbieders reageren, jij kiest, wij regelen de rest.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <LinkButton href="/events/new" size="lg" iconRight={<MoveRight className="size-4" />}>
              Start mijn evenement
            </LinkButton>
            <LinkButton href="/#hoe-het-werkt" size="lg" variant="outline">
              Bekijk hoe het werkt
            </LinkButton>
          </div>
          <div className="mt-10 flex items-center gap-6 text-sm text-ink-faint">
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-2">
                {["#B5674A", "#6B7A5E", "#9C5540", "#B08A3E"].map((c) => (
                  <div key={c} className="size-7 rounded-full border-2 border-paper" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span>
                Al gebruikt voor <CountUp target={2000} suffix="+" /> evenementen
              </span>
            </div>
            <div className="hidden items-center gap-1 sm:flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="size-3.5 fill-ochre text-ochre" />
              ))}
              <span className="ml-1">
                <CountUp target={4.8} decimals={1} /> / 5
              </span>
            </div>
          </div>
        </div>

        <div className="relative animate-rise [animation-delay:150ms]">
          <AiInterviewCard />

          <div className="motion-float-a absolute -bottom-6 -left-6 hidden rounded-2xl border border-line bg-white px-4 py-3 shadow-lg sm:block">
            <p className="text-xs text-ink-faint">Reacties binnen</p>
            <p className="font-display text-lg text-ink">48 uur</p>
          </div>
          <div className="motion-float-b absolute -right-4 -top-4 hidden rounded-2xl border border-line bg-white px-4 py-3 shadow-lg sm:block">
            <Badge tone="success">3 offertes ontvangen</Badge>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </section>
  );
}
