import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "Privacyverklaring — Vyra" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line-soft py-6 last:border-0">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <span className="text-sm font-medium uppercase tracking-wide text-coral">Juridisch</span>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink sm:text-4xl">Privacyverklaring</h1>
        <p className="mt-3 text-sm text-ink-faint">Laatst bijgewerkt: 12 augustus 2026</p>

        <div className="mt-6 rounded-2xl border border-warning-50 bg-warning-50 px-4 py-3 text-sm text-warning">
          Dit is een zorgvuldig opgestelde conceptversie, geen juridisch sluitend advies. Laat &apos;m bij twijfel nog checken door een jurist voordat je grootschalig gebruikers werft.
        </div>

        <Card className="mt-8 divide-y divide-line-soft p-0">
          <div className="px-6">
            <Section title="1. Wie is verantwoordelijk voor je gegevens">
              <p>
                Vyra wordt op dit moment beheerd door Cem Adıyaman, handelend als particulier (nog geen KVK-inschrijving). Voor
                vragen over deze privacyverklaring of je gegevens kun je contact opnemen via{" "}
                <a href="mailto:cemadiyaman91@gmail.com" className="text-coral hover:underline">cemadiyaman91@gmail.com</a>.
              </p>
            </Section>

            <Section title="2. Welke gegevens verzamelen we">
              <p><strong className="text-ink">Accountgegevens:</strong> e-mailadres, voor- en achternaam, land, taalvoorkeur, valuta.</p>
              <p><strong className="text-ink">Evenementgegevens:</strong> alles wat je invoert over je evenement — type, datum, locatie, aantal gasten, budget, stijl en wensen.</p>
              <p><strong className="text-ink">Gesprekken met de AI:</strong> de tekst die je typt tijdens het AI-interview en in de AI-assistent-chat.</p>
              <p><strong className="text-ink">Aanvraag- en offertegegevens:</strong> welke leveranciers je aanvraagt, ontvangen offertes, en je keuzes (swipes, shortlist, acceptaties).</p>
              <p><strong className="text-ink">Betaalgegevens:</strong> bedrag en betaalstatus. Gevoelige betaalgegevens zoals kaartnummers slaan wij zelf nooit op — dat verloopt volledig via Stripe.</p>
              <p><strong className="text-ink">Technische gegevens:</strong> IP-adres en sessiegegevens via inlogcookies, om je ingelogd te houden en het platform te beveiligen.</p>
            </Section>

            <Section title="3. Waarvoor gebruiken we deze gegevens">
              <p>Het aanmaken en beheren van je account; het genereren van een eventplan en het matchen met leveranciers via AI; het namens jou versturen van aanvragen naar leveranciers; het verwerken van betalingen en het innen van de platformcommissie (9,5%); en het verbeteren van het platform.</p>
            </Section>

            <Section title="4. Rechtsgrond voor de verwerking">
              <p>We verwerken je gegevens op basis van: uitvoering van de overeenkomst (art. 6 lid 1 sub b AVG) voor het leveren van de dienst waarvoor je je hebt aangemeld; toestemming (art. 6 lid 1 sub a) voor optionele communicatie; en gerechtvaardigd belang (art. 6 lid 1 sub f) voor beveiliging en platformverbetering.</p>
            </Section>

            <Section title="5. Met wie delen we gegevens">
              <p><strong className="text-ink">Supabase</strong> — database en accountbeheer, gehost in de EU (Frankfurt).</p>
              <p><strong className="text-ink">OpenAI</strong> — verwerkt de tekst van je AI-interview en vragen aan de AI-assistent om antwoorden/aanbevelingen te genereren; gevestigd in de VS. Bij zakelijk gebruik via de API gebruikt OpenAI deze gegevens niet om hun modellen mee te trainen.</p>
              <p><strong className="text-ink">Stripe</strong> — verwerkt betalingen; PCI-DSS gecertificeerd.</p>
              <p><strong className="text-ink">Vercel</strong> — hosting van de website.</p>
              <p>We verkopen je gegevens nooit aan derden voor marketingdoeleinden.</p>
            </Section>

            <Section title="6. Doorgifte buiten de EU">
              <p>OpenAI en Stripe kunnen gegevens verwerken buiten de EU (met name de VS). Deze partijen hanteren passende waarborgen (zoals Standard Contractual Clauses) om een vergelijkbaar beschermingsniveau te garanderen als binnen de EU.</p>
            </Section>

            <Section title="7. Hoe lang bewaren we je gegevens">
              <p>We bewaren je gegevens zolang je een account hebt. Verwijder je je account, dan verwijderen we je persoonsgegevens binnen 30 dagen — met uitzondering van gegevens die we wettelijk verplicht langer moeten bewaren, zoals factuurgegevens (7 jaar fiscale bewaarplicht).</p>
            </Section>

            <Section title="8. Jouw rechten">
              <p>Je hebt recht op inzage, rectificatie, verwijdering, beperking, overdraagbaarheid en bezwaar. Neem hiervoor contact op via <a href="mailto:cemadiyaman91@gmail.com" className="text-coral hover:underline">cemadiyaman91@gmail.com</a>. Ook heb je het recht een klacht in te dienen bij de Autoriteit Persoonsgegevens.</p>
            </Section>

            <Section title="9. Cookies">
              <p>We gebruiken alleen functionele cookies die noodzakelijk zijn om je ingelogd te houden (via Supabase Auth). Geen trackingcookies, geen advertentiecookies.</p>
            </Section>

            <Section title="10. Minderjarigen">
              <p>Vyra is niet gericht op personen onder de 16 jaar. Blijkt een account toch door een minderjarige te zijn aangemaakt zonder toestemming van een ouder/voogd, dan verwijderen we dit account op verzoek.</p>
            </Section>

            <Section title="11. Wijzigingen">
              <p>We kunnen deze privacyverklaring aanpassen. Bij belangrijke wijzigingen laten we dit weten via e-mail of een melding in de app.</p>
            </Section>
          </div>
        </Card>
      </main>
      <Footer />
    </>
  );
}
