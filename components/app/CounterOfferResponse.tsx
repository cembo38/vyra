"use client";

import { useTransition } from "react";
import { HandCoins, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/config";
import { respondToCounterOfferAction } from "@/lib/actions/marketplace-actions";

/**
 * Getoond op de aanvraagdetailpagina van een leverancier (in plaats van de
 * gewone "je hebt al een offerte ingediend"-kaart) zodra een organisator een
 * tegenbod heeft gestuurd — zie app/supplier/(portal)/requests/[id]/page.tsx.
 */
export function CounterOfferResponse({
  offerId,
  originalPriceCents,
  counterPriceCents,
  counterNote,
}: {
  offerId: string;
  originalPriceCents: number;
  counterPriceCents: number;
  counterNote: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function respond(accept: boolean) {
    startTransition(async () => {
      await respondToCounterOfferAction(offerId, accept);
    });
  }

  return (
    <div className="rounded-2xl border border-ochre-50 bg-ochre-50 p-5">
      <div className="flex items-start gap-3">
        <HandCoins className="mt-0.5 size-5 shrink-0 text-ochre" />
        <div>
          <p className="font-medium text-ink">De organisator heeft een tegenbod gestuurd</p>
          <p className="mt-1 text-sm text-ink-soft">
            {formatCurrency(counterPriceCents)} <span className="text-ink-faint">(jouw offerte was {formatCurrency(originalPriceCents)})</span>
          </p>
          {counterNote && <p className="mt-2 text-sm italic text-ink-soft">&ldquo;{counterNote}&rdquo;</p>}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() => respond(true)}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-clay px-4 py-2 text-sm font-medium text-white hover:bg-clay-dark disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : "Accepteren"}
        </button>
        <button
          disabled={pending}
          onClick={() => respond(false)}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink-soft hover:border-ink/40 hover:text-ink disabled:opacity-50"
        >
          Afwijzen
        </button>
      </div>
    </div>
  );
}
