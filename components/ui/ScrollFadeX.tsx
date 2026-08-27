"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Randschaduw aan de kant(en) van een horizontaal scrollbare strook waar nog
 * meer inhoud buiten beeld staat — vervangt de oudere pure-CSS
 * `.scroll-fade-x`/`.scroll-fade-x-white`-truc (twee gestapelde
 * `background-attachment: local`/`scroll`-gradiënten op hetzelfde element).
 *
 * BUGFIX (aug. 2026, gemeld door Cem met een live screenshot op
 * EventSubNav): die CSS-truc bleek op iOS Safari onbetrouwbaar — bij het
 * verticaal scrollen van de pagina repaint't Safari de achtergrond van een
 * geneste horizontaal-scrollbare strip soms niet correct, waardoor een
 * grijze, uitgesmeerde balk over de tabs bleef "plakken" ("de carrousel
 * verdwijnt"). Dit is een bekende WebKit-eigenaardigheid met gemengde
 * `background-attachment`-waarden binnen `overflow-x: auto`. Dit component
 * doet optisch hetzelfde (een schaduw die verschijnt zodra er nog inhoud te
 * scrollen valt) maar puur via de scrollpositie + een opacity-overgang op
 * twee losse laagjes — geen `background-attachment`, dus geen Safari-
 * repaint-bug.
 *
 * `className` gaat naar het scrollbare binnenste element zelf (dezelfde
 * `overflow-x-auto`/`flex`/padding-klassen als voorheen op de ene div met
 * de CSS-klasse stonden); `containerClassName` naar de buitenste,
 * niet-scrollende wrapper (bv. rand/afronding/schaduw van een kaart) zodat
 * de schaduwlaagjes daar netjes in meeclippen i.p.v. buiten afgeronde
 * hoeken uit te steken.
 */
export function ScrollFadeX({
  children,
  className = "",
  containerClassName = "",
  variant = "paper",
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  variant?: "paper" | "white";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function update() {
      if (!el) return;
      setFadeLeft(el.scrollLeft > 4);
      setFadeRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    // Vangt ook op als de inhoud zelf van breedte verandert (bv. na een
    // toggle/filter-wijziging) zonder dat er al gescrold is.
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resizeObserver.disconnect();
    };
  }, []);

  const fadeColor = variant === "white" ? "#ffffff" : "var(--color-paper)";

  return (
    <div className={cn("relative", containerClassName)}>
      <div ref={ref} className={className}>
        {children}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-8 transition-opacity duration-150"
        style={{ background: `linear-gradient(to right, ${fadeColor}, transparent)`, opacity: fadeLeft ? 1 : 0 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 transition-opacity duration-150"
        style={{ background: `linear-gradient(to left, ${fadeColor}, transparent)`, opacity: fadeRight ? 1 : 0 }}
      />
    </div>
  );
}
