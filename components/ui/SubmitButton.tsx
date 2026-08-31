"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  /**
   * Voor een icoon-only knop (bv. een los uitlog- of prullenbak-icoontje
   * zonder zichtbare tekst) — tijdens bezig-status vervangt de V gewoon het
   * icoon zelf, zonder labeltekst ernaast (die past er toch niet bij en zou
   * de knop breder maken dan zijn vaste icoon-formaat toestaat).
   */
  iconOnly?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled" | "className" | "children">;

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
 * Overige knop-attributen (`aria-label`, `title`, `name`, `value`,
 * `formAction`, ...) worden gewoon doorgegeven — zo blijft dit ook bruikbaar
 * voor icoon-only knoppen (met `iconOnly`) en voor formulieren met meerdere
 * submit-knoppen die elk een eigen `name`/`value` meesturen (bv. drie
 * RSVP-statusknoppen in hetzelfde formulier).
 *
 * Bij zo'n formulier met meerdere submit-knoppen is React's `pending` waar
 * voor ALLE knoppen tegelijk zodra er ÉÉN wordt geklikt (useFormStatus kent
 * geen "welke knop specifiek"). `data` (de daadwerkelijk verstuurde
 * FormData) bevat wél de naam/waarde van de knop die als submitter
 * fungeerde — daarmee tonen we de V alleen op precies díe ene knop, en niet
 * op alle knoppen in het formulier tegelijk.
 */
export function SubmitButton({ children, pendingLabel, className, iconOnly, name, value, ...rest }: SubmitButtonProps) {
  const { pending, data } = useFormStatus();
  const isThisButtonPending = pending && (name === undefined || data?.get(name as string) === value);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cn(className, "disabled:cursor-not-allowed disabled:opacity-80")}
      {...rest}
    >
      {isThisButtonPending ? (
        iconOnly ? (
          <VyraMarkSpinner className="text-base" />
        ) : (
          <span className="inline-flex items-center justify-center gap-2">
            <VyraMarkSpinner className="text-base" />
            {pendingLabel ?? "Even geduld…"}
          </span>
        )
      ) : (
        children
      )}
    </button>
  );
}
