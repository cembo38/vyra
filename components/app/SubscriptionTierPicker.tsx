"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, CreditCard, Crown, Loader2, Sparkles } from "lucide-react";
import { changeSubscriptionTierAction, openBillingPortalAction } from "@/lib/actions/supplier-actions";
import { SUBSCRIPTION_TIERS, SUBSCRIPTION_TIER_ORDER, SubscriptionTier } from "@/lib/config";
import type { SupplierTierUpgradeRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Vergelijkingstabel + zelfbedienings-keuze voor de vijf abonnementsniveaus
 * (spec-item #53-vervolg). Sinds aug. 2026 via ECHTE Stripe-facturering:
 * een betaald niveau kiezen stuurt de leverancier naar een Stripe Checkout-
 * sessie (of past, als hij al een lopend abonnement heeft, dat meteen aan —
 * zie changeSubscriptionTierAction). Instap (gratis) blijft altijd instant
 * self-service, net als downgraden ernaartoe.
 *
 * `paymentsEnabled` bepaalt alleen de KNOPTEKST/het label hier — de server
 * action (`changeSubscriptionTierAction`) bepaalt zelf, onafhankelijk van
 * wat de client denkt, of Stripe daadwerkelijk geconfigureerd is en valt zo
 * nodig terug op de oude handmatige "vraag aan, Cem keurt goed"-flow. Zolang
 * Cem zijn Stripe-sleutels nog niet heeft gezet (zie .env.example) is
 * `paymentsEnabled` dus `false` en blijft alles werken zoals voorheen.
 */
export function SubscriptionTierPicker({
  currentTier,
  currentBillingInterval,
  inTrial,
  trialBookingsRemaining,
  pendingUpgradeRequest,
  paymentsEnabled,
  hasStripeCustomer,
}: {
  currentTier: SubscriptionTier;
  currentBillingInterval: "monthly" | "annual" | null;
  inTrial: boolean;
  trialBookingsRemaining: number;
  pendingUpgradeRequest: SupplierTierUpgradeRequest | null;
  paymentsEnabled: boolean;
  hasStripeCustomer: boolean;
}) {
  const [selected, setSelected] = useState(currentTier);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [requestedTier, setRequestedTier] = useState<string | null>(pendingUpgradeRequest?.requestedTier ?? null);
  const [intervalByTier, setIntervalByTier] = useState<Partial<Record<SubscriptionTier, "monthly" | "annual">>>({});
  const [pending, startTransition] = useTransition();
  const [portalPending, startPortalTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();

  function intervalFor(tier: SubscriptionTier): "monthly" | "annual" {
    if (intervalByTier[tier]) return intervalByTier[tier]!;
    if (tier === selected && currentBillingInterval) return currentBillingInterval;
    return "annual";
  }

  function choose(tier: SubscriptionTier) {
    if (pending) return;
    const interval = tier === "instap" ? null : intervalFor(tier);
    if (tier === selected && (tier === "instap" || interval === currentBillingInterval)) return;
    setError(null);
    setNotice(null);
    setPendingTier(tier);
    startTransition(async () => {
      const result = await changeSubscriptionTierAction(tier, interval);
      // Bij een echte Stripe-checkout stuurt de server action zelf door
      // (redirect) — deze code wordt dan niet meer bereikt, de browser
      // navigeert al weg naar Stripe.
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        setPendingTier(null);
        return;
      }
      setPendingTier(null);
      if (result.mode === "requested") {
        setRequestedTier(tier);
      } else if (result.mode === "scheduled_cancel") {
        setNotice("Je Instap-niveau gaat in zodra je huidige betaalperiode bij Stripe afloopt — tot die tijd behoud je gewoon je huidige niveau en functies.");
      } else if (result.mode === "downgraded") {
        setSelected(tier);
      }
      router.refresh();
    });
  }

  function manageBilling() {
    if (portalPending) return;
    setError(null);
    startPortalTransition(async () => {
      const result = await openBillingPortalAction();
      if (!result.ok) setError(result.error ?? "Kon het Stripe-portaal niet openen.");
      // Bij succes stuurt de server action zelf door naar Stripe.
    });
  }

  return (
    <div>
      {inTrial && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-ochre/40 bg-ochre-50 px-4 py-3 text-sm text-ink">
          <Sparkles className="size-4 shrink-0 text-ochre" />
          <span>
            Je zit nog in je proefperiode: <strong>volledige toegang</strong> tot alles wat Vyra te bieden heeft, 0% commissie. Nog{" "}
            <strong>{trialBookingsRemaining}</strong> gratis boeking{trialBookingsRemaining !== 1 ? "en" : ""} te gaan — wil je alvast
            een betaald niveau kiezen, gebruik dan de knop hieronder bij dat niveau.
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
          const cardIndex = SUBSCRIPTION_TIER_ORDER.indexOf(key);
          const currentIndex = SUBSCRIPTION_TIER_ORDER.indexOf(selected);
          const interval = intervalFor(key);
          const isCurrent = key === selected && (key === "instap" || interval === currentBillingInterval);
          const isBusy = pending && pendingTier === key;
          const isUpgradeInFallback = !paymentsEnabled && cardIndex > currentIndex;
          const isRequested = requestedTier === key;
          return (
            <div
              key={key}
              className={cn(
                "flex min-w-0 flex-col rounded-xl border p-4",
                isCurrent ? "border-clay bg-clay/5" : isRequested ? "border-ochre/40 bg-ochre-50/40" : "border-line-soft",
                isUpgradeInFallback && requestedTier && !isRequested && "opacity-70"
              )}
            >
              <div className="flex items-center gap-1.5">
                <p className="font-display text-base text-ink">{def.label}</p>
                {def.badge === "aanbevolen" && <Sparkles className="size-3.5 shrink-0 text-ochre" />}
                {def.badge === "elite" && <Crown className="size-3.5 shrink-0 text-clay" />}
              </div>
              {def.billing ? (
                <>
                  <p className="mt-0.5 break-words text-sm font-medium text-ink-soft">
                    {interval === "annual" ? def.billing.annual.priceLabel : def.billing.monthly.priceLabel}
                  </p>
                  <div className="mt-1.5 inline-flex w-fit rounded-lg border border-line-soft p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setIntervalByTier((s) => ({ ...s, [key]: "monthly" }))}
                      className={cn("rounded-md px-2 py-1 font-medium", interval === "monthly" ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}
                    >
                      Maandelijks
                    </button>
                    <button
                      type="button"
                      onClick={() => setIntervalByTier((s) => ({ ...s, [key]: "annual" }))}
                      className={cn("rounded-md px-2 py-1 font-medium", interval === "annual" ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}
                    >
                      Jaarlijks
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-0.5 break-words text-sm font-medium text-ink-soft">{def.priceLabel}</p>
              )}
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
                disabled={pending || isCurrent || (isUpgradeInFallback && (isRequested || Boolean(requestedTier)))}
                onClick={() => choose(key)}
                className={cn(
                  "lift-hover mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-60",
                  isCurrent
                    ? "border border-clay/40 bg-clay-50 text-ink"
                    : isRequested
                      ? "border border-ochre/40 bg-ochre-50 text-ink"
                      : isUpgradeInFallback
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
                    : isUpgradeInFallback
                      ? "Upgrade aanvragen"
                      : "Dit niveau kiezen"}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      {notice && <p className="mt-3 text-xs text-sage">{notice}</p>}
      {requestedTier && (
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-ochre/40 bg-ochre-50 px-4 py-3 text-sm text-ink">
          <Clock className="size-4 shrink-0 text-ochre" />
          <span>
            Je aanvraag voor <strong>{SUBSCRIPTION_TIERS[requestedTier as SubscriptionTier].label}</strong> staat klaar — we
            beoordelen &rsquo;m zo snel mogelijk en laten je per e-mail weten of je bent geüpgraded.
          </span>
        </div>
      )}

      {hasStripeCustomer && (
        <button
          type="button"
          disabled={portalPending}
          onClick={manageBilling}
          className="lift-hover mt-4 inline-flex items-center gap-1.5 rounded-xl border border-line-soft bg-paper px-3 py-2 text-xs font-medium text-ink hover:border-ink/30 disabled:opacity-60"
        >
          {portalPending ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
          Beheer abonnement bij Stripe
        </button>
      )}

      <p className="mt-3 text-xs text-ink-faint">
        {paymentsEnabled
          ? "Instap kiezen (of ernaartoe downgraden) kan altijd meteen zelf, gratis en zonder wachttijd. Een betaald niveau kiezen stuurt je naar een beveiligde Stripe-checkout; wisselen tussen twee betaalde niveaus past je lopende abonnement direct aan. Betaalmethode wijzigen, facturen inzien of opzeggen kan via \"Beheer abonnement bij Stripe\" hierboven."
          : "Downgraden naar een lager niveau kan altijd meteen zelf, gratis en zonder wachttijd. Upgraden naar een hoger (betaald) niveau vraag je hierboven met één klik aan — we beoordelen elke aanvraag handmatig en nemen daarna contact met je op om het abonnement definitief te maken."}
      </p>
    </div>
  );
}
