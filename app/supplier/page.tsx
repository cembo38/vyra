import Link from "next/link";
import { ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { SupplierOfferBuilder } from "@/components/app/SupplierOfferBuilder";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { DeadlineCountdown } from "@/components/ui/Countdown";
import { SUPPLIER_CATEGORY_LABELS, ServiceRequest } from "@/lib/types";
import { getSupplierById } from "@/lib/data/suppliers";
import { formatCurrency } from "@/lib/config";
import { CheckCircle2, Clock, Percent, Sparkles, Star } from "lucide-react";

export const metadata = { title: "Voor leveranciers — Vyra" };

export default function SupplierLandingPage() {
  // Deze marketingpagina toont normaliter een live voorbeeld uit een echt
  // account; met echte, per-gebruiker beveiligde data (RLS) is er geen
  // platformbreed "demo-event" meer beschikbaar zonder in te loggen. De
  // volledige leverancier-flow (met eigen account) is een volgende stap —
  // zie docs/ARCHITECTURE.md.
  const demoEvent: { name: string } | null = null as { name: string } | null;
  const openRequests: ServiceRequest[] = [];

  return (
    <>
      <MarketingHeader />
      <main>
        <section className="mx-auto max-w-5xl px-6 pb-14 pt-16 text-center">
          <span className="text-sm font-medium uppercase tracking-wide text-coral">Voor leveranciers</span>
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
          <div className="mx-auto grid max-w-5xl gap-6 px-6 sm:grid-cols-3">
            <Stat icon={<Clock className="size-5" />} title="Duidelijke deadlines" description="Reageer binnen 48 uur op een aanvraag — met automatische herinneringen." />
            <Stat icon={<Percent className="size-5" />} title="9,5% commissie" description="Alleen bij een succesvolle boeking. Geen abonnement, geen verborgen kosten." />
            <Stat icon={<Star className="size-5" />} title="Bouw je reputatie op" description="Reviews, reactiesnelheid en acceptatiegraad verbeteren je positie in de matching." />
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="mb-1 font-display text-2xl text-ink">Voorbeeld: je aanvragen-inbox</h2>
          <p className="mb-6 text-sm text-ink-faint">Zo ziet een openstaande aanvraag eruit voor een leverancier op het platform.</p>

          {openRequests.length === 0 ? (
            <Card><p className="text-sm text-ink-faint">Op dit moment geen open demo-aanvragen.</p></Card>
          ) : (
            <div className="space-y-3">
              {openRequests.map((req) => {
                const supplier = getSupplierById(req.supplierIds[0]);
                return (
                  <Card key={req.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{SUPPLIER_CATEGORY_LABELS[req.categoryKey]}</p>
                        <p className="mt-1 font-display text-lg text-ink">{demoEvent?.name}</p>
                        <p className="mt-1 text-sm text-ink-soft">{req.desiredService}</p>
                        {req.specialRequests && <p className="mt-1 text-sm text-ink-faint">Wens: {req.specialRequests}</p>}
                      </div>
                      <DeadlineCountdown deadlineIso={req.deadlineAt} />
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3 text-sm">
                      <span className="text-ink-faint">Aanvraag voor: <strong className="text-ink">{supplier?.companyName}</strong></span>
                      {req.budgetCents && <span className="text-ink-faint">Budget-indicatie: {formatCurrency(req.budgetCents)}</span>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <div id="offerte-assistent" className="mt-10">
            <SupplierOfferBuilder />
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-20">
          <Card className="bg-ink text-paper">
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 text-coral" />
              <p className="font-display text-xl">Klaar om aanvragen te ontvangen?</p>
            </div>
            <p className="mt-2 text-sm text-white/70">Registreer je bedrijf met categorie, werkgebied en portfolio — je eerste aanvraag kan al deze week binnenkomen.</p>
            <Link href="/signup?intent=supplier" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-coral">
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
      <div className="flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet">{icon}</div>
      <p className="mt-3 font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{description}</p>
    </div>
  );
}
