/**
 * Eén bron van waarheid voor de breedte van de permanente app-zijbalk
 * (`NavShell`) — gebruikt door `NavShell` zelf én door elke pagina-layout
 * die er ruimte voor moet vrijhouden (`SIDEBAR_OFFSET_CLASS`). Zo blijven
 * beide kanten gegarandeerd gelijk, ook als de breedte ooit wijzigt.
 *
 * Icoon-only rail vanaf `md` (768px, iPad-portret) — 76px breed.
 * Volledige, met labels, zijbalk vanaf `lg` (1024px, iPad-landscape+) —
 * dit is de val-terug-stand voor apparaten zonder écht hover (aanraken).
 * Op apparaten MET een muis/trackpad (`(hover: hover) and (pointer: fine)`)
 * staat de zijbalk vanaf `lg` juist standaard ingeklapt (net als de
 * `md`-rail) en klapt hij bij hover/focus soepel uit — zie de
 * `.app-sidebar`-regels in `app/globals.css`, die deze `lg:w-64`-fallback
 * op zulke apparaten overschrijven zonder hem ooit te laten verdwijnen.
 *
 * LET OP: de klassen hieronder staan bewust als volledige, letterlijke
 * strings (niet via template-literal samengesteld uit `SIDEBAR_RAIL_WIDTH_PX`)
 * — Tailwind v4 scant de brontekst op complete klassenamen; een
 * template-literal zoals `md:w-[${n}px]` levert nergens de letterlijke
 * tekst "md:w-[76px]" op, dus die zou stilzwijgend NIET meegecompileerd
 * worden. Als de breedte ooit wijzigt, werk beide strings hieronder samen
 * bij (en de identieke waarde in `SIDEBAR_RAIL_WIDTH_PX`, puur informatief).
 */
export const SIDEBAR_RAIL_WIDTH_PX = 76;

/** Toe te passen op de vaste zijbalk zelf (`NavShell`). */
export const SIDEBAR_WIDTH_CLASS = "app-sidebar md:w-[76px] lg:w-64";

/** Toe te passen op de content-wrapper die naast de vaste zijbalk staat. */
export const SIDEBAR_OFFSET_CLASS = "app-sidebar-offset md:pl-[76px] lg:pl-64";
