import Link from "next/link";
import { ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { SupplierOfferBuilder } from "@/components/app/SupplierOfferBuilder";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { SUBSCRIPTION_TIERS, SUBSCRIPTION_TIER_ORDER, TRIAL_BOOKING_COUNT, formatCurrency } from "@/lib/config";
import { CheckCircle2, Clock, Crown, Percent, Sparkles, Star } from "lucide-react";

export const metadata = { title: "Voor leveranciers — Vyra" };

export default function SupplierLandingPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="mx-auto max-w-5xl px-6 pb-14 pt-16 text-center">
          <span className="text-sm font-medium uppercase tracking-wide text-clay">Voor leveranciers</span>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">Ontvang aanvragen die al bij je passen</h1>
          <p className="mx-auto mt-4 max-w-xl text-ink-soft">
            Geen koude acquisitie meer. Vyra stuurt je alleen aanvragen die matchen met je categorie, locatie en beschikbaarheid — jij reageert binnen 48 uur met een offerte.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/signup?intent=supplier" size="lg">Registreer je bedrijf</LinkButton>
            <LinkButton href="#offerte-assistent" size="lg" variant="outline">Bekijk de AI-offerte-assistent</LinkButton>
          </div>
        </section>

        <section className="border-y border-line-soft bg-paper-dim/60 py-14">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 sm:grid-cols-3">
            <Stat icon={<Clock className="size-5" />} title="Duidelijke deadlines" description="Reageer binnen 48 uur op een aanvraag — met automatische herinneringen." />
            {/* Sinds het abonnementenmodel voor leveranciers (spec-item #53-vervolg,
                SaaS-pivot) is er geen vast commissiepercentage meer om hier te
                noemen — leveranciers proberen eerst gratis uit, en kiezen daarna
                een abonnement. Zie de vergelijkingstabel verderop op deze pagina. */}
            <Stat icon={<Percent className="size-5" />} title={`Eerste ${TRIAL_BOOKING_COUNT} boekingen gratis`} description="Volledige toegang tot alles wat Vyra te bieden heeft, zonder abonnement — kies daarna het niveau dat bij je past." />
            <Stat icon={<Star className="size-5" />} title="Bouw je reputatie op" description="Reviews, reactiesnelheid en acceptatiegraad verbeteren je positie in de matching." />
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="mb-8 text-center">
            <h2 className="font-display text-2xl text-ink">Kies het abonnement dat bij je past</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-ink-soft">
              Eerst {TRIAL_BOOKING_COUNT} boekingen volledig gratis uitproberen, met volledige toegang. Daarna kies je zelf — op elk
              moment te wijzigen.
            </p>
          </div>
          {/* Zie de toelichting in SubscriptionTierPicker.tsx: viewport-breakpoints
              voor het aantal kolommen kijken naar de schermbreedte, niet naar de
              werkelijke breedte van dit grid — `auto-fit`/`minmax` lost dat structureel op. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            {SUBSCRIPTION_TIER_ORDER.map((key) => {
              const def = SUBSCRIPTION_TIERS[key];
              return (
                <Card key={key} className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-base text-ink">{def.label}</p>
                    {def.badge === "aanbevolen" && <Sparkles className="size-3.5 shrink-0 text-ochre" />}
                    {def.badge === "elite" && <Crown className="size-3.5 shrink-0 text-clay" />}
                  </div>
                  <p className="mt-0.5 break-words text-sm font-medium text-ink-soft">{def.priceLabel}</p>
                  <p className="mt-1.5 break-words text-xs text-ink-faint">{def.tagline}</p>
                  {/* Zie de toelichting in SubscriptionTierPicker.tsx: zonder
                      een apart tekst-element bleedt lange perk-tekst als
                      anonieme flex-child buiten zijn kolom i.p.v. af te breken. */}
                  <ul className="mt-3 min-w-0 flex-1 space-y-1.5">
                    {def.perks.slice(0, 4).map((perk) => (
                      <li key={perk} className="flex items-start gap-1.5 text-xs text-ink-soft">
                        <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-sage" />
                        <span className="min-w-0 break-words">{perk}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-16">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="font-display text-2xl text-ink">Zo ziet een aanvraag eruit</h2>
            <Badge tone="clay">Ter illustratie</Badge>
          </div>
          <p className="mb-6 text-sm text-ink-faint">Een fictief voorbeeld — zodra je bent geregistreerd, verschijnen hier je eigen, echte aanvragen.</p>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{SUPPLIER_CATEGORY_LABELS.catering}</p>
                <p className="mt-1 font-display text-lg text-ink">Bruiloft van Lisa &amp; Tom</p>
                <p className="mt-1 text-sm text-ink-soft">Volledige catering voor 80 gasten, inclusief bediening</p>
                <p className="mt-1 text-sm text-ink-faint">Wens: minimaal twee vegetarische opties</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                <Clock className="size-3.5" /> Nog 36 uur om te reageren
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3 text-sm">
              <span className="text-ink-faint">Aanvraag voor: <strong className="text-ink">jouw bedrijf</strong></span>
              <span className="text-ink-faint">Budget-indicatie: {formatCurrency(650000)}</span>
            </div>
          </Card>

          <div id="offerte-assistent" className="mt-10">
            <SupplierOfferBuilder />
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-20">
          <Card className="bg-ink text-paper">
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 text-clay" />
              <p className="font-display text-xl">Klaar om aanvragen te ontvangen?</p>
            </div>
            <p className="mt-2 text-sm text-white/70">Registreer je bedrijf met categorie, werkgebied en portfolio — je eerste aanvraag kan al deze week binnenkomen.</p>
            <Link href="/signup?intent=supplier" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-clay">
              <CheckCircle2 className="size-4" /> Start je registratie
            </Link>
          </Card>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Stat({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 [box-shadow:var(--shadow-card)]">
      <div className="flex size-9 items-center justify-center rounded-lg bg-sage-50 text-sage">{icon}</div>
      <p className="mt-3 font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{description}</p>
    </div>
  );
}
