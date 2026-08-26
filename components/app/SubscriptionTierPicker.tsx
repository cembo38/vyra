"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Crown, Loader2, Sparkles } from "lucide-react";
import { requestSubscriptionUpgradeAction, setSubscriptionTierAction } from "@/lib/actions/supplier-actions";
import { SUBSCRIPTION_TIERS, SUBSCRIPTION_TIER_ORDER, SubscriptionTier } from "@/lib/config";
import type { SupplierTierUpgradeRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Vergelijkingstabel + zelfbedienings-keuze voor de vijf abonnementsniveaus
 * (spec-item #53-vervolg, SaaS-pivot) — vervangt de eerdere aan/uit
 * `ProSubscriptionToggle`. Zelfde eerlijke "geen automatische incasso"-
 * boodschap als daar: dit kiest meteen het niveau (en dus de perks/
 * limieten/commissie), maar het daadwerkelijk innen van het maandbedrag
 * loopt nog niet automatisch — dat volgt zodra er een Stripe Payment Link
 * per niveau is ingesteld (zie de toelichting onderaan).
 *
 * FIX (livegang-audit augustus 2026): een leverancier kon hier voorheen
 * zelf rechtstreeks naar Enterprise upgraden, zonder ooit te betalen —
 * `setSubscriptionTierAction` blokkeert dat nu server-side. Downgraden
 * blijft altijd één klik. Upgraden gaat sinds de livegang-audit via een
 * aanvraag-flow: de leverancier vraagt een niveau aan, Cem beoordeelt en
 * keurt handmatig goed/af (zie AdminTierUpgradeRequestActions op
 * /admin/leveranciers) — een tussenstap totdat er een echte betaalflow is.
 */
export function SubscriptionTierPicker({
  currentTier,
  inTrial,
  trialBookingsRemaining,
  pendingUpgradeRequest,
}: {
  currentTier: SubscriptionTier;
  inTrial: boolean;
  trialBookingsRemaining: number;
  pendingUpgradeRequest: SupplierTierUpgradeRequest | null;
}) {
  const [selected, setSelected] = useState(currentTier);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [requestedTier, setRequestedTier] = useState<string | null>(pendingUpgradeRequest?.requestedTier ?? null);
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

  function requestUpgrade(tier: SubscriptionTier) {
    if (pending || requestedTier) return;
    setError(null);
    setPendingTier(tier);
    startTransition(async () => {
      const result = await requestSubscriptionUpgradeAction(tier);
      if (!result.ok) {
        setError(result.error ?? "Aanvragen is niet gelukt.");
        setPendingTier(null);
        return;
      }
      setRequestedTier(tier);
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
            <strong>{trialBookingsRemaining}</strong> gratis boeking{trialBookingsRemaining !== 1 ? "en" : ""} te gaan — wil je alvast
            een betaald niveau aanvragen, gebruik dan de knop hieronder bij dat niveau.
          </span>
        </div>
      )}

      {/*
        BEWUST geen viewport-breakpoints (sm:/lg:/xl:) meer voor het aantal
        kolommen — dit was de daadwerkelijke oorzaak van de layoutbug die Cem
        meldde: die breakpoints kijken naar de schermbreedte, niet naar hoe
        breed déze kaart daadwerkelijk is. Op de leveranciersprofielpagina
        staat deze tabel binnen een smalle `max-w-lg`-kolom (zie
        app/supplier/(portal)/profile/page.tsx) — bij een breed scherm
        activeerde `xl:grid-cols-5` dan alsnog 5 kolommen, terwijl er maar
        ~450px daadwerkelijke ruimte was: elke kolom werd ~80px breed en de
        tekst brak zelfs midden in korte woorden af.
        `repeat(auto-fit,minmax(200px,1fr))` laat de browser i.p.v. daarvan
        kijken naar de ECHTE beschikbare breedte van dit grid en past het
        aantal kolommen daarop aan (1 kolom als er nauwelijks ruimte is, tot
        5 op een écht brede pagina) — dat werkt overal correct, ongeacht in
        welke kolombreedte dit component ooit wordt geplaatst.
      */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {SUBSCRIPTION_TIER_ORDER.map((key) => {
          const def = SUBSCRIPTION_TIERS[key];
          const isCurrent = key === selected;
          const isBusy = pending && pendingTier === key;
          const isLocked = SUBSCRIPTION_TIER_ORDER.indexOf(key) > SUBSCRIPTION_TIER_ORDER.indexOf(selected);
          const isRequested = requestedTier === key;
          return (
            <div
              key={key}
              className={cn(
                "flex min-w-0 flex-col rounded-xl border p-4",
                isCurrent ? "border-clay bg-clay/5" : isRequested ? "border-ochre/40 bg-ochre-50/40" : "border-line-soft",
                isLocked && requestedTier && !isRequested && "opacity-70"
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
                disabled={pending || isCurrent || (isLocked && (isRequested || Boolean(requestedTier)))}
                onClick={() => (isLocked ? requestUpgrade(key) : choose(key))}
                className={cn(
                  "lift-hover mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-60",
                  isCurrent
                    ? "border border-clay/40 bg-clay-50 text-ink"
                    : isRequested
                      ? "border border-ochre/40 bg-ochre-50 text-ink"
                      : isLocked
                        ? "border border-line-soft bg-paper text-ink hover:border-ink/30"
                        : "bg-ink text-white hover:bg-ink/90"
                )}
              >
                {isBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : isCurrent ? (
                  <Check className="size-3.5" />
                ) : isRequested ? (
                  <Clock className="size-3.5" />
                ) : null}
                {isCurrent
                  ? "Huidig niveau"
                  : isRequested
                    ? "Aanvraag verstuurd"
                    : isLocked
                      ? "Upgrade aanvragen"
                      : "Dit niveau kiezen"}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      {requestedTier && (
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-ochre/40 bg-ochre-50 px-4 py-3 text-sm text-ink">
          <Clock className="size-4 shrink-0 text-ochre" />
          <span>
            Je aanvraag voor <strong>{SUBSCRIPTION_TIERS[requestedTier as SubscriptionTier].label}</strong> staat klaar — we
            beoordelen &rsquo;m zo snel mogelijk en laten je per e-mail weten of je bent geüpgraded.
          </span>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-faint">
        Downgraden naar een lager niveau kan altijd meteen zelf, gratis en zonder wachttijd. Upgraden naar een hoger (betaald) niveau
        vraag je hierboven met één klik aan — we beoordelen elke aanvraag handmatig en nemen daarna contact met je op om het
        abonnement definitief te maken.
      </p>
    </div>
  );
}
