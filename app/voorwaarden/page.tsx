import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { Card } from "@/components/ui/Card";
import { PLATFORM_COMMISSION_RATE } from "@/lib/config";

export const metadata = { title: "Algemene voorwaarden — Vyra" };

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line-soft py-6 last:border-0">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <span className="text-sm font-medium uppercase tracking-wide text-clay">Juridisch</span>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink sm:text-4xl">Algemene voorwaarden</h1>
        <p className="mt-3 text-sm text-ink-faint">Laatst bijgewerkt: 12 augustus 2026</p>

        <Card className="mt-8 divide-y divide-line-soft p-0">
          <div className="px-6">
            <Article title="Artikel 1 — Definities">
              <p><strong className="text-ink">Vyra / het platform:</strong> de dienst zoals aangeboden via vyra.now.</p>
              <p><strong className="text-ink">Organisator:</strong> de gebruiker die een evenement plant via het platform.</p>
              <p><strong className="text-ink">Leverancier:</strong> een bedrijf dat via het platform diensten aanbiedt aan organisatoren.</p>
              <p><strong className="text-ink">Aanbieding:</strong> elke offerte die een leverancier via het platform verstuurt.</p>
            </Article>

            <Article title="Artikel 2 — Toepasselijkheid">
              <p>Deze voorwaarden gelden voor elk gebruik van Vyra, zowel door organisatoren als door leveranciers.</p>
            </Article>

            <Article title="Artikel 3 — De dienst">
              <p>
                Vyra is een AI-ondersteund platform dat organisatoren helpt hun evenement te plannen: het genereert op basis van
                een gesprek een eventplan, stuurt automatisch aanvragen naar passende leveranciers, en biedt tools om offertes te
                vergelijken en te boeken. Vyra treedt op als bemiddelaar tussen organisator en leverancier; Vyra is zelf geen
                partij bij de overeenkomst die ontstaat tussen organisator en leverancier.
              </p>
            </Article>

            <Article title="Artikel 4 — AI-aanbevelingen">
              <p>
                Alle door AI gegenereerde aanbevelingen (eventplan, budgetadvies, risicosignalering, geschatte prijzen) zijn
                indicatief en niet bindend. Vyra kan geen garanties geven over de juistheid, volledigheid of geschiktheid van
                AI-gegenereerde content. Controleer aanbevelingen altijd zelf voordat je een beslissing neemt.
              </p>
            </Article>

            <Article title="Artikel 5 — Commissie en betalingen">
              <p>
                Vyra rekent een platformcommissie van {(PLATFORM_COMMISSION_RATE * 100).toFixed(1)}% over het totaalbedrag van elke
                succesvol geboekte dienst. Dit percentage is vooraf zichtbaar bij het afrekenen, zonder verborgen kosten.
                Betalingen worden verwerkt via Stripe; Vyra ontvangt de betaling en keert het leveranciersdeel uit conform de
                overeengekomen voorwaarden.
              </p>
            </Article>

            <Article title="Artikel 6 — Verplichtingen van de organisator">
              <p>Je verstrekt correcte en volledige informatie over je evenement. Je bent zelf verantwoordelijk voor het beoordelen en accepteren van offertes. Je gebruikt het platform niet om leveranciers die je via Vyra hebt gevonden buiten het platform om te boeken met als doel de platformcommissie te omzeilen.</p>
            </Article>

            <Article title="Artikel 7 — Verplichtingen van de leverancier">
              <p>Je reageert naar waarheid en binnen de gestelde termijn (doorgaans 48 uur) op aanvragen. Prijzen en voorwaarden in je offerte zijn bindend zodra een organisator deze accepteert.</p>
            </Article>

            <Article title="Artikel 8 — Aansprakelijkheid">
              <p>
                Vyra spant zich in om een betrouwbaar platform te bieden, maar is niet aansprakelijk voor de daadwerkelijke
                uitvoering van diensten door leveranciers, schade als gevolg van annulering door een leverancier, of
                onjuistheden in door leveranciers verstrekte informatie. De aansprakelijkheid van Vyra is in alle gevallen beperkt
                tot het bedrag van de betreffende platformcommissie.
              </p>
            </Article>

            <Article title="Artikel 9 — Intellectueel eigendom">
              <p>Alle rechten op het platform, de merknaam Vyra en de onderliggende software berusten bij Vyra.</p>
            </Article>

            <Article title="Artikel 10 — Beëindiging">
              <p>Je kunt je account op elk moment verwijderen via je profielpagina of door contact op te nemen. Vyra kan een account beëindigen bij misbruik of overtreding van deze voorwaarden.</p>
            </Article>

            <Article title="Artikel 11 — Wijzigingen">
              <p>Vyra kan deze voorwaarden wijzigen. Bij materiële wijzigingen informeren we gebruikers vooraf via e-mail of een melding in de app.</p>
            </Article>

            <Article title="Artikel 12 — Toepasselijk recht en geschillen">
              <p>Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden bij voorkeur in onderling overleg opgelost.</p>
            </Article>
          </div>
        </Card>
      </main>
      <Footer />
    </>
  );
}
