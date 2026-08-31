"use client";

import { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * Submit-knop voor een `<form action={serverAction}>` die tijdens het
 * versturen z'n eigen bezig-status laat zien (de pulserende V uit het
 * Vyra-logo, zie VyraMarkSpinner in PageLoader.tsx) — spec-item aug. 2026,
 * n.a.v. een livegang-incident: het inloggen leek "helemaal kapot" (geen
 * enkele reactie op de knop) terwijl het in werkelijkheid gewoon traag was.
 * Zonder ENIGE laadindicator is "traag" voor een gebruiker niet te
 * onderscheiden van "kapot".
 *
 * MOET een afstammeling van het `<form>` zijn (useFormStatus leest de
 * dichtstbijzijnde omliggende formulierstatus) — dus altijd binnen dezelfde
 * `<form action={...}>` gebruiken, nooit ernaast.
 *
 * `className` bepaalt de knopstijl zelf (kleur/vorm/breedte, door de
 * aanroeper meegegeven, hetzelfde patroon als de losse knoppen die dit
 * component vervangt) — deze knop voegt daar alleen de bezig-status aan toe.
 */
export function SubmitButton({ children, pendingLabel, className }: { children: ReactNode; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(className, "disabled:cursor-not-allowed disabled:opacity-80")}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <VyraMarkSpinner className="text-base" />
          {pendingLabel ?? "Even geduld…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
