"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}
// Tijdens server-rendering bestaat `window` niet — neem daar altijd "geen
// voorkeur voor minder beweging" aan (false); zodra de client hydrateert
// leest useSyncExternalStore meteen de echte waarde via getSnapshot(), dus
// dit veroorzaakt geen hydration-mismatch (in tegenstelling tot een eerdere
// opzet die de waarde pas ná mount via een effect bijwerkte — dat triggerde
// de `react-hooks/set-state-in-effect`-lintregel, want `setState` binnen de
// effect-body zelf aanroepen i.p.v. vanuit een subscribe-callback is precies
// het patroon dat die regel probeert te voorkomen).
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Homepage-in-beweging (spec-item, motion-voorstel augustus 2026) — vóór
 * deze update had de site nergens `prefers-reduced-motion` gecontroleerd,
 * ook al bestonden er al doorlopende animaties (bv. de belletje-ring op de
 * notificatieknop). Nu de homepage een stuk meer continue beweging krijgt
 * (ademende achtergrond, zwevende kaartjes, een tekstband), is dit niet
 * meer optioneel: sommige bezoekers hebben "verminder beweging" bewust
 * aangezet in hun besturingssysteem (vaak om reisziekte/migraine-klachten
 * te voorkomen), en dan mag een site dat niet negeren.
 *
 * De doorlopende CSS-animaties zelf staan al globaal uit via de
 * `@media (prefers-reduced-motion: reduce)`-regel in globals.css — deze
 * hook is er voor het JAVASCRIPT-gestuurde gedrag dat CSS niet kan
 * afvangen (bv. of de kinetische kop-tekst überhaupt wisselt, of de
 * typ-simulatie in de hero speelt of meteen de eindstand toont).
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
