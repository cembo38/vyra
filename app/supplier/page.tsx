import Link from "next/link";
import { ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { SupplierOfferBuilder } from "@/components/app/SupplierOfferBuilder";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { formatCurrency, INTRO_COMMISSION_RATE } from "@/lib/config";
import { CheckCircle2, Clock, Percent, Sparkles, Star } from "lucide-react";

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
            {/* Was hardcoded op de oude vaste 9,5%-commissie — zie de
                toelichting bij TrustSection.tsx voor waarom dat sinds het
                gestaffelde model (spec-item #53) niet meer klopt. */}
            <Stat icon={<Percent className="size-5" />} title={`Vanaf ${(INTRO_COMMISSION_RATE * 100).toFixed(0)}% commissie`} description="Alleen bij een succesvolle boeking. Geen abonnement verplicht, geen verborgen kosten." />
            <Stat icon={<Star className="size-5" />} title="Bouw je reputatie op" description="Reviews, reactiesnelheid en acceptatiegraad verbeteren je positie in de matching." />
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
