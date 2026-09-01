"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, CreditCard, Crown, Sparkles } from "lucide-react";
import { changeSubscriptionTierAction, openBillingPortalAction } from "@/lib/actions/supplier-actions";
import { SUBSCRIPTION_TIERS, SUBSCRIPTION_TIER_ORDER, SubscriptionTier, formatCurrency } from "@/lib/config";
import type { SupplierTierUpgradeRequest } from "@/lib/types";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
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
  /**
   * Livegang-feedback (Cem, sep. 2026): elke kaart had eerst zijn EIGEN
   * maand/jaar-knopje (`intervalByTier`, per tier apart) — dat betekende dat
   * dezelfde keuze op 4 plekken los stond, en de prijs dus 4x apart kon
   * wisselen i.p.v. in één keer. Nu ÉÉN gedeelde knop bovenaan de hele
   * tabel die alle 4 kaarten tegelijk laat omschakelen.
   */
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">(currentBillingInterval ?? "annual");
  const [pending, startTransition] = useTransition();
  const [portalPending, startPortalTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();

  function choose(tier: SubscriptionTier) {
    if (pending) return;
    const interval = tier === "instap" ? null : billingInterval;
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

  /** Instap staat los van de vergelijkingsgrid — zie de toelichting bij de JSX hieronder. */
  const paidTierOrder = SUBSCRIPTION_TIER_ORDER.filter((key) => key !== "instap");
  const instapDef = SUBSCRIPTION_TIERS.instap;
  const instapIsCurrent = selected === "instap";
  const instapIsBusy = pending && pendingTier === "instap";

  /**
   * Prijs die we tonen op een kaart: ALTIJD als maandbedrag, ook bij
   * jaarlijkse facturering (Cems expliciete verzoek — het volledige
   * jaarbedrag in het groot tonen ("€588/jaar") werkte ontmoedigend). Bij
   * "annual" is dit dus het gedeelde maandbedrag (jaarbedrag / 12), niet het
   * losse maandtarief `billing.monthly` (dat is bewust hoger, de "prijs voor
   * flexibiliteit" — zie SUBSCRIPTION_TIERS-toelichting in lib/config.ts).
   * Het daadwerkelijke jaarbedrag blijft wél zichtbaar, maar alleen klein en
   * secundair (`billingCaption` hieronder) — nooit verborgen, want dat is
   * precies het bedrag dat wordt afgeschreven.
   */
  function priceDisplayFor(tier: SubscriptionTier): { amountLabel: string; caption: string } | null {
    const def = SUBSCRIPTION_TIERS[tier];
    if (!def.billing) return null;
    const interval = billingInterval;
    if (interval === "monthly") {
      return { amountLabel: `${def.billing.monthly.priceLabel}`, caption: "Maandelijks opzegbaar." };
    }
    const monthlyEquivalentCents = Math.round(def.billing.annual.priceCents / 12);
    return {
      amountLabel: `${formatCurrency(monthlyEquivalentCents)}/maand`,
      caption: `Jaarlijks in één keer afgeschreven (${formatCurrency(def.billing.annual.priceCents)}/jaar), daarna automatisch met telkens een jaar verlengd.`,
    };
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
        Instap staat expres LOS van de vergelijkingsgrid, als smalle
        horizontale balk erboven (Cems verzoek: "niet zo prominent een
        verticale balk, mag kleiner en horizontaal boven de 4
        abonnementsvormen") — Instap is bewust het minst opvallende niveau
        (geen abonnementsgeld, karige perks, puur een "probeer eerst uit"-
        instap), dus verdient ook visueel minder gewicht dan de vier echte
        abonnementen die er evenveel naast elkaar staan.
      */}
      <div
        className={cn(
          "mb-3 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
          instapIsCurrent ? "border-clay bg-clay/5" : "border-line-soft"
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="font-display text-sm text-ink">{instapDef.label}</p>
            <p className="text-xs font-medium text-ink-soft">{instapDef.priceLabel}</p>
          </div>
          <p className="mt-0.5 break-words text-xs text-ink-faint">{instapDef.tagline}</p>
        </div>
        <button
          type="button"
          disabled={pending || instapIsCurrent}
          onClick={() => choose("instap")}
          className={cn(
            "lift-hover inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-60",
            instapIsCurrent ? "border border-clay/40 bg-clay-50 text-ink" : "border border-line-soft bg-paper text-ink hover:border-ink/30"
          )}
        >
          {instapIsBusy ? <VyraMarkSpinner className="text-sm" /> : instapIsCurrent ? <Check className="size-3.5" /> : null}
          {instapIsCurrent ? "Huidig niveau" : "Dit niveau kiezen"}
        </button>
      </div>

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
        4 op een écht brede pagina) — dat werkt overal correct, ongeacht in
        welke kolombreedte dit component ooit wordt geplaatst.
      */}
      {/*
        ÉÉN gedeelde maand/jaar-knop voor de hele tabel (Cems verzoek, sep.
        2026) — vervangt de vier losse toggles die er eerst per kaart stonden.
        Wisselen hier herberekent meteen alle vier de prijzen eronder.
      */}
      <div className="mb-3 inline-flex w-fit rounded-lg border border-line-soft p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setBillingInterval("monthly")}
          className={cn("rounded-md px-3 py-1.5 font-medium", billingInterval === "monthly" ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}
        >
          Maandelijks
        </button>
        <button
          type="button"
          onClick={() => setBillingInterval("annual")}
          className={cn("rounded-md px-3 py-1.5 font-medium", billingInterval === "annual" ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}
        >
          Jaarlijks
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {paidTierOrder.map((key) => {
          const def = SUBSCRIPTION_TIERS[key];
          const cardIndex = SUBSCRIPTION_TIER_ORDER.indexOf(key);
          const currentIndex = SUBSCRIPTION_TIER_ORDER.indexOf(selected);
          const isCurrent = key === selected && billingInterval === currentBillingInterval;
          const isBusy = pending && pendingTier === key;
          const isUpgradeInFallback = !paymentsEnabled && cardIndex > currentIndex;
          const isRequested = requestedTier === key;
          const price = priceDisplayFor(key);
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
              {price && (
                <>
                  <p className="mt-0.5 break-words text-sm font-medium text-ink-soft">{price.amountLabel}</p>
                  {/*
                    Klein en secundair — Cem wil het jaarbedrag niet meer
                    groot/eerst tonen (werkte ontmoedigend), maar het moet wel
                    ergens blijven staan: dit ÍS het bedrag dat wordt
                    afgeschreven, en Artikel 5 van de voorwaarden verwijst
                    hiernaar (jaarabonnement, niet tussentijds opzegbaar,
                    automatische verlenging).
                  */}
                  <p className="mt-1 break-words text-[11px] leading-snug text-ink-faint">{price.caption}</p>
                </>
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
                  <VyraMarkSpinner className="text-sm" />
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
          {portalPending ? <VyraMarkSpinner className="text-sm" /> : <CreditCard className="size-3.5" />}
          Beheer abonnement bij Stripe
        </button>
      )}

      <p className="mt-3 text-xs text-ink-faint">
        {paymentsEnabled
          ? "Instap kiezen (of ernaartoe downgraden) kan altijd meteen zelf, gratis en zonder wachttijd. Een ander betaald niveau kiezen — ook wisselen tussen twee betaalde niveaus — stuurt je telkens naar een beveiligde Stripe-checkout; het nog niet gebruikte deel van je huidige periode wordt dan automatisch verrekend met de eerstvolgende afschrijving. Betaalmethode wijzigen, facturen inzien of opzeggen kan via \"Beheer abonnement bij Stripe\" hierboven."
          : "Downgraden naar een lager niveau kan altijd meteen zelf, gratis en zonder wachttijd. Upgraden naar een hoger (betaald) niveau vraag je hierboven met één klik aan — we beoordelen elke aanvraag handmatig en nemen daarna contact met je op om het abonnement definitief te maken."}
      </p>
    </div>
  );
}
