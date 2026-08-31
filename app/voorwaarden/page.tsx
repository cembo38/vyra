import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { Card } from "@/components/ui/Card";
import { SUBSCRIPTION_TIERS, SUBSCRIPTION_TIER_ORDER, TRIAL_BOOKING_COUNT, formatCurrency } from "@/lib/config";

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

            <Article title="Artikel 5 — Abonnementen, proefperiode en betalingen">
              <p>
                Vyra verdient aan een maandelijks abonnement met leveranciers, niet aan een opslag op de boeking van de
                organisator: organisatoren betalen nooit platformkosten en betalen de leverancier altijd het overeengekomen
                bedrag rechtstreeks. Elke nieuwe leverancier krijgt eerst zijn eerste {TRIAL_BOOKING_COUNT} succesvolle boekingen
                volledig gratis, met volledige toegang tot alle functionaliteit van het platform (proefperiode). Daarna kiest de
                leverancier zelf een van de volgende abonnementsniveaus, elk met eigen limieten (aantal categorieën, foto&apos;s,
                werkgebied), positie in de matching en — zodra betalen via het platform beschikbaar is — commissietarief per
                boeking:
              </p>
              <ul className="mt-2.5 list-disc space-y-1 pl-5">
                {SUBSCRIPTION_TIER_ORDER.map((key) => {
                  const def = SUBSCRIPTION_TIERS[key];
                  const flatRate = def.commissionTiers.length === 1 && def.commissionTiers[0].uptoCents === null ? def.commissionTiers[0].rate : null;
                  const commissionLabel =
                    flatRate != null
                      ? `${(flatRate * 100).toFixed(0)}% commissie`
                      : `gestaffelde commissie (${def.commissionTiers.map((t) => `${(t.rate * 100).toFixed(1)}%${t.uptoCents ? ` tot ${formatCurrency(t.uptoCents)}` : " daarboven"}`).join(", ")})`;
                  return (
                    <li key={key}>
                      <strong className="text-ink">{def.label}</strong> — {def.priceLabel}, {commissionLabel}
                      {def.guaranteedTopPosition ? ", gegarandeerd bovenaan bij matching binnen categorie en regio" : ""}.
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2.5">
                Een leverancier kan op elk moment zelf van niveau wisselen via zijn profiel. Instap is en blijft gratis en direct
                zelf te kiezen. Bij een betaald niveau kiest de leverancier tussen een maandelijks opzegbaar tarief of een
                jaartarief (in één keer per jaar afgeschreven, tegen een lagere maandprijs); het bijbehorende bedrag wordt
                automatisch via Stripe geïncasseerd. Downgraden naar Instap vanuit een betaald niveau behoudt de reeds betaalde
                periode: de wijziging gaat pas in zodra die periode afloopt, zonder terugbetaling van het resterende bedrag.
              </p>
              <p className="mt-2.5">
                Zolang betalen via het platform nog niet beschikbaar is, verwerkt Vyra zelf geen betalingen tussen organisator en
                leverancier en int Vyra dus ook geen commissie over boekingen: de organisator en de leverancier spreken het
                overeengekomen bedrag rechtstreeks met elkaar af en rekenen buiten het platform om af (bijvoorbeeld via
                bankoverschrijving). Zodra betalen via het platform beschikbaar komt, wordt dit artikel daarover geïnformeerd
                voordat het van toepassing wordt.
              </p>
            </Article>

            <Article title="Artikel 6 — Verplichtingen van de organisator">
              <p>
                Je verstrekt correcte en volledige informatie over je evenement. Je bent zelf verantwoordelijk voor het
                beoordelen en accepteren van offertes. Zodra betalen via het platform beschikbaar is, gebruik je het platform
                niet om leveranciers die je via Vyra hebt gevonden buiten het platform om te boeken met als doel de
                platformcommissie te omzeilen — zolang dat nog niet het geval is, is rechtstreeks afrekenen met de leverancier
                (zie Artikel 5) juist de bedoelde werkwijze.
              </p>
            </Article>

            <Article title="Artikel 7 — Verplichtingen van de leverancier">
              <p>Je reageert naar waarheid en binnen de gestelde termijn (doorgaans 48 uur) op aanvragen. Prijzen en voorwaarden in je offerte zijn bindend zodra een organisator deze accepteert.</p>
            </Article>

            <Article title="Artikel 8 — Aansprakelijkheid">
              <p>
                Vyra spant zich in om een betrouwbaar platform te bieden, maar is niet aansprakelijk voor de daadwerkelijke
                uitvoering van diensten door leveranciers, schade als gevolg van annulering door een leverancier, of
                onjuistheden in door leveranciers verstrekte informatie. De aansprakelijkheid van Vyra is in alle gevallen beperkt
                tot het bedrag dat Vyra voor de betreffende boeking daadwerkelijk heeft ontvangen (commissie en/of
                abonnementsgeld); is dat nihil — bijvoorbeeld bij een boeking tijdens de proefperiode of op een 0%-commissieniveau
                — dan is de aansprakelijkheid beperkt tot een symbolisch bedrag van €25.
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
              <p className="mt-2">
                Is een boeking betaald en loopt er onverhoopt iets mis — de leverancier komt niet opdagen, de geleverde dienst wijkt sterk af van de offerte, of er ontstaat onenigheid over een betaling —
                dan kunnen zowel de organisator als de leverancier dit rechtstreeks bij de betreffende boeking melden. Vyra beoordeelt de melding, neemt indien nodig contact op met beide partijen en
                deelt een schriftelijke uitkomst. Dit interne meldproces staat los van het recht van beide partijen om de zaak alsnog aan de rechter voor te leggen.
              </p>
            </Article>
          </div>
        </Card>
      </main>
      <Footer />
    </>
  );
}
