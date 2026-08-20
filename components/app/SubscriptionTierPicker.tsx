"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import { setSubscriptionTierAction } from "@/lib/actions/supplier-actions";
import { SUBSCRIPTION_TIERS, SUBSCRIPTION_TIER_ORDER, SubscriptionTier } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Vergelijkingstabel + zelfbedienings-keuze voor de vijf abonnementsniveaus
 * (spec-item #53-vervolg, SaaS-pivot) — vervangt de eerdere aan/uit
 * `ProSubscriptionToggle`. Zelfde eerlijke "geen automatische incasso"-
 * boodschap als daar: dit kiest meteen het niveau (en dus de perks/
 * limieten/commissie), maar het daadwerkelijk innen van het maandbedrag
 * loopt nog niet automatisch — dat volgt zodra er een Stripe Payment Link
 * per niveau is ingesteld (zie de toelichting onderaan).
 */
export function SubscriptionTierPicker({
  currentTier,
  inTrial,
  trialBookingsRemaining,
}: {
  currentTier: SubscriptionTier;
  inTrial: boolean;
  trialBookingsRemaining: number;
}) {
  const [selected, setSelected] = useState(currentTier);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function choose(tier: SubscriptionTier) {
    if (tier === selected || pending) return;
    setError(null);
    setPendingTier(tier);
    startTransition(async () => {
      const result = await setSubscriptionTierAction(tier);
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        setPendingTier(null);
        return;
      }
      setSelected(tier);
      setPendingTier(null);
      router.refresh();
    });
  }

  return (
    <div>
      {inTrial && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-ochre/40 bg-ochre-50 px-4 py-3 text-sm text-ink">
          <Sparkles className="size-4 shrink-0 text-ochre" />
          <span>
            Je zit nog in je proefperiode: <strong>volledige toegang</strong> tot alle Enterprise-functies, 0% commissie. Nog{" "}
            <strong>{trialBookingsRemaining}</strong> gratis boeking{trialBookingsRemaining !== 1 ? "en" : ""} te gaan — kies daarna
            hieronder alvast het niveau waarmee je verder wilt.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {SUBSCRIPTION_TIER_ORDER.map((key) => {
          const def = SUBSCRIPTION_TIERS[key];
          const isCurrent = key === selected;
          const isBusy = pending && pendingTier === key;
          return (
            <div
              key={key}
              className={cn(
                "flex min-w-0 flex-col rounded-xl border p-4",
                isCurrent ? "border-clay bg-clay/5" : "border-line-soft"
              )}
            >
              <div className="flex items-center gap-1.5">
                <p className="font-display text-base text-ink">{def.label}</p>
                {def.badge === "aanbevolen" && <Sparkles className="size-3.5 shrink-0 text-ochre" />}
                {def.badge === "elite" && <Crown className="size-3.5 shrink-0 text-clay" />}
              </div>
              <p className="mt-0.5 break-words text-sm font-medium text-ink-soft">{def.priceLabel}</p>
              <p className="mt-1.5 break-words text-xs text-ink-faint">{def.tagline}</p>
              {/*
                Elke <li> is een flex-rij (vinkje + tekst) — zonder een apart
                element om de teksst heen krijgt die tekst als anonieme
                flex-child een standaard `min-width: auto`, waardoor lange
                perks niet afbreken maar over de kolomgrens heen buiten hun
                kaart bleeden (precies het layoutprobleem dat Cem meldde,
                zichtbaar als tekst die over de volgende kaart heen viel).
                `min-w-0` op zowel de kaart als op de tekst-span dwingt de
                browser om wél netjes af te breken binnen de kolombreedte.
              */}
              <ul className="mt-3 min-w-0 flex-1 space-y-1.5">
                {def.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-1.5 text-xs text-ink-soft">
                    <Check className="mt-0.5 size-3 shrink-0 text-sage" />
                    <span className="min-w-0 break-words">{perk}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={pending || isCurrent}
                onClick={() => choose(key)}
                className={cn(
                  "lift-hover mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-60",
                  isCurrent ? "border border-clay/40 bg-clay-50 text-ink" : "bg-ink text-white hover:bg-ink/90"
                )}
              >
                {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : isCurrent ? <Check className="size-3.5" /> : null}
                {isCurrent ? "Huidig niveau" : `Dit niveau kiezen`}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      <p className="mt-3 text-xs text-ink-faint">
        Nog een zelfbedienings-keuze in deze pilotfase — geen automatische incasso. Je kiest hier alvast je niveau (en de bijbehorende
        perks/limieten/commissie gelden meteen); zodra er een betaallink per niveau is ingesteld, hoor je van ons hoe je het
        maandbedrag betaalt. Je kunt op elk moment weer wisselen.
      </p>
    </div>
  );
}
