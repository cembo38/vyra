/**
 * Inhoud van de Help & FAQ-pagina's (spec-item aug. 2026, verzoek Cem: "een
 * volledig zoekbare FAQ / kennisbank... apart voor organisatoren en
 * leveranciers"). Twee gescheiden lijsten omdat de twee doelgroepen andere
 * vragen hebben (een organisator vraagt nooit naar commissietarieven, een
 * leverancier nooit naar RSVP-links) — zie app/help/page.tsx (organisatoren)
 * en app/supplier/(portal)/help/page.tsx (leveranciers). Beide pagina's delen
 * hetzelfde weergave-component (components/app/FaqPage.tsx): zoeken, per
 * categorie uitklappen, en een "Vraag het VyrAI"-invoerveld bovenaan dat een
 * antwoord baseert op precies deze inhoud (zie lib/ai/faq.ts).
 *
 * BELANGRIJK, doorlopende afspraak met Cem: telkens als er een nieuwe
 * functionaliteit bijkomt of een bestaande wijzigt, hoort hier (en/of in de
 * andere lijst, als het beide doelgroepen raakt) een bijgewerkt of nieuw
 * item bij — dit bestand is dus geen eenmalige snapshot, maar iets om
 * voortaan bij elke feature-wijziging opnieuw langs te lopen.
 *
 * Bewust GEEN harde bedragen hier (abonnementsprijzen, commissiepercentages)
 * — die staan al elders dynamisch (SubscriptionTierPicker.tsx, Artikel 5 van
 * app/voorwaarden/page.tsx) en zouden hier als losse tekst-string stil
 * kunnen verouderen. Antwoorden over prijzen verwijzen daarom bewust door
 * naar de profielpagina/voorwaarden i.p.v. zelf een bedrag te noemen.
 */

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export interface FaqCategory {
  id: string;
  label: string;
  entries: FaqEntry[];
}

export const ORGANIZER_FAQ: FaqCategory[] = [
  {
    id: "plannen",
    label: "Plannen met AI",
    entries: [
      {
        id: "org-plannen-hoe-werkt-het",
        question: "Hoe werkt het plannen van mijn evenement met AI precies?",
        answer:
          "Je start bij 'Nieuw evenement' met een kort gesprek: je vertelt in gewone taal wat je wilt organiseren, en Vyra stelt automatisch de ontbrekende vervolgvragen (aantal gasten, locatie, datum, budget, sfeer). Op basis daarvan stelt Vyra een planvoorstel samen: een lijst met categorieën (bijv. catering, muziek, locatie) die je nodig hebt, elk gemarkeerd als essentieel, aanbevolen of optioneel. Je kunt dat plan op de planpagina zelf aanpassen voordat je verdergaat.",
      },
      {
        id: "org-plannen-categorie-optioneel",
        question: "Wat betekent essentieel, aanbevolen en optioneel bij een categorie?",
        answer:
          "Dat is de prioriteit die Vyra aan een categorie toekent op basis van jouw evenement. Essentiële en aanbevolen categorieën staan standaard aan en delen samen je hele budget. Optionele categorieën ('nice to have') staan standaard uit en beginnen op €0 — pas als je zo'n categorie zelf aanvinkt om mee te nemen, krijgt hij een eigen deel van het budget (dat gaat dan automatisch van de andere schuiven af, je budget blijft altijd volledig verdeeld).",
      },
      {
        id: "org-plannen-budget-schuiven",
        question: "Hoe pas ik mijn budgetverdeling per categorie aan?",
        answer:
          "Op de budgetpagina heeft elke categorie een eigen schuif. Budget dat je bij de ene categorie weghaalt, komt terug in een gezamenlijke 'nog te verdelen'-pot; budget dat je ergens bij optelt, komt uit diezelfde pot. Andere categorieën verschuiven daardoor nooit ongevraagd mee — jij bepaalt zelf waar het geld naartoe gaat.",
      },
      {
        id: "org-plannen-assistent",
        question: "Wat doet de VyrAI-assistent op mijn evenementdashboard?",
        answer:
          "Dat is een chatvenster waar je in gewone taal vragen kunt stellen over je eigen evenement — bijvoorbeeld 'wat moet ik nog regelen?', 'welke leveranciers hebben nog niet gereageerd?' of 'hoe sta ik ervoor met mijn budget?'. De assistent kent de actuele status van jouw budget, aanvragen, offertes en planning, en geeft daar een kort, concreet antwoord op.",
      },
    ],
  },
  {
    id: "leveranciers",
    label: "Leveranciers vinden en boeken",
    entries: [
      {
        id: "org-lev-aanvraag",
        question: "Hoe stuur ik een aanvraag naar een leverancier?",
        answer:
          "Op de aanvragenpagina van je evenement laat Vyra per categorie de best passende leveranciers zien. Vyra stelt automatisch een aanvraagbericht voor, dat je zelf nog kunt aanpassen voordat je 'm verstuurt. Leveranciers hebben daarna doorgaans 48 uur om te reageren; je ziet de resterende tijd per aanvraag terug.",
      },
      {
        id: "org-lev-offertes-vergelijken",
        question: "Hoe vergelijk ik offertes van verschillende leveranciers?",
        answer:
          "Zodra er offertes binnen zijn voor een categorie, kun je ze op drie manieren bekijken: als swipe-kaartenstack (rechts voor 'interessant', links om af te wijzen), als lijst, of naast elkaar in een vergelijkingsweergave. Zodra je één offerte in een categorie accepteert (eventueel met alleen een aanbetaling), worden de andere offertes in diezelfde categorie automatisch niet meer beschikbaar — zo boek je nooit twee leveranciers voor dezelfde categorie.",
      },
      {
        id: "org-lev-berichten",
        question: "Waar vind ik mijn gesprek met een leverancier terug?",
        answer:
          "Onder 'Berichten' bij je evenement staat per categorie waar je een aanvraag voor verstuurd hebt een eigen gesprek met die leverancier — daar stem je details af en (op dit moment) ook de betaling zelf.",
      },
      {
        id: "org-lev-review",
        question: "Kan ik een review achterlaten voor een leverancier?",
        answer:
          "Ja, nadat de evenementdatum voorbij is en je een offerte bij die leverancier hebt geaccepteerd. Je review (met eventueel foto's of een video) blijft verborgen voor de leverancier totdat ook die zijn/haar kant heeft achtergelaten, of na maximaal 14 dagen — zo beïnvloeden reviews elkaar niet. Een review is niet meer te wijzigen na het versturen.",
      },
    ],
  },
  {
    id: "betalen",
    label: "Betalen",
    entries: [
      {
        id: "org-betalen-hoe",
        question: "Hoe betaal ik een leverancier nadat ik een offerte heb geaccepteerd?",
        answer:
          "Vyra verwerkt op dit moment nog geen betalingen via het platform: jij en de leverancier spreken het bedrag rechtstreeks met elkaar af (bijvoorbeeld via bankoverschrijving), meestal via het berichtengesprek bij die aanvraag. De 'Bevestig'-knop op de betaalpagina markeert de boeking alleen als bevestigd in Vyra — er gaat geen geld via die knop. Zodra betalen via het platform beschikbaar komt, laten we dat vooraf duidelijk weten.",
      },
      {
        id: "org-betalen-kosten-platform",
        question: "Betaal ik als organisator platformkosten aan Vyra?",
        answer:
          "Nee. Vyra verdient aan een abonnement met leveranciers, niet aan een opslag op jouw boeking — je betaalt de leverancier altijd precies het bedrag dat jullie samen zijn overeengekomen.",
      },
    ],
  },
  {
    id: "gasten",
    label: "Gasten en planning",
    entries: [
      {
        id: "org-gasten-rsvp",
        question: "Hoe werkt de gastenlijst en RSVP?",
        answer:
          "Onder 'Gasten' bij je evenement voeg je gasten toe (los, of in bulk geplakt) en houd je RSVP-status, aantal introducees en dieetwensen bij. Elke gast krijgt een eigen RSVP-link om zelf door te geven of hij/zij komt — jij hoeft dus niet iedereen los te bellen.",
      },
      {
        id: "org-gasten-planning",
        question: "Wat staat er in de planning/timeline van mijn evenement?",
        answer:
          "Vyra stelt automatisch een checklist samen met concrete stappen en deadlines, afgestemd op je evenementdatum en je gekozen categorieën (bijvoorbeeld 'X maanden van tevoren: [categorie] regelen'). Je kunt items afvinken zodra ze klaar zijn.",
      },
    ],
  },
  {
    id: "gastenfoto",
    label: "Gastenfoto-pagina",
    entries: [
      {
        id: "org-gastenfoto-wat-is-het",
        question: "Wat is een gastenfoto-pagina?",
        answer:
          "Een eigen, deelbare webpagina voor je evenement waar gasten via een link of QR-code rechtstreeks foto's (en bij het Premium-pakket video's) kunnen uploaden — zonder dat ze zelf een Vyra-account nodig hebben. Je vindt en koopt deze onder het tabblad 'Gastenfoto's' bij je evenement; de prijzen en precieze verschillen tussen de pakketten staan daar bij elk pakket vermeld.",
      },
      {
        id: "org-gastenfoto-moderatie",
        question: "Zien gasten elkaars foto's meteen?",
        answer:
          "Nee. Elke upload komt eerst bij jou terecht als 'te beoordelen' op het tabblad 'Gastenfoto's'. Pas als jij een foto, video of gastenboek-bericht goedkeurt, wordt deze zichtbaar voor iedereen die de pagina bezoekt. Zo houd jij de controle over wat er op de pagina van je evenement verschijnt.",
      },
      {
        id: "org-gastenfoto-bewaartermijn",
        question: "Hoe lang blijft de gastenfoto-pagina online?",
        answer:
          "Dat hangt af van het gekozen pakket (60 dagen, een half jaar of een jaar na de evenementdatum — zie het tabblad 'Gastenfoto's' voor de exacte termijn van jouw pakket). Daarna worden alle foto's, video's en gastenboek-berichten automatisch en onomkeerbaar verwijderd. Wil je ze bewaren, download ze dan op tijd (bij Plus en Premium kan dat in één keer als zip-bestand).",
      },
    ],
  },
  {
    id: "account",
    label: "Account en privacy",
    entries: [
      {
        id: "org-account-beide-rollen",
        question: "Kan ik zowel evenementen plannen als zelf leverancier zijn?",
        answer:
          "Ja, dat kan met hetzelfde account. Bij het aanmaken van je account kies je of je wilt organiseren, aanbieden, of beide; heb je al een leveranciersprofiel, dan wissel je met één klik tussen de organisator- en leverancierskant via het knopje in het menu.",
      },
      {
        id: "org-account-export",
        question: "Kan ik mijn gegevens downloaden of mijn account laten verwijderen?",
        answer:
          "Je kunt je eigen gegevens (evenementen, gasten, je reviews) als bestand downloaden via je profielpagina. Account verwijderen kun je aanvragen vanaf je profiel; omdat dit lopende boekingen kan raken, wordt zo'n aanvraag door ons handmatig beoordeeld en uitgevoerd in plaats van meteen automatisch.",
      },
      {
        id: "org-account-hulp-knop",
        question: "Ik loop tegen iets aan of iets werkt niet — wat nu?",
        answer:
          "Rechtsonder op elke pagina zit een klein rond hulp-icoon. Klik erop en kies 'Ik heb een vraag' of 'Het werkt niet' — je bericht komt direct bij ons binnen, ook zonder dat je bent ingelogd. Laat je e-mailadres achter als je een reactie wilt.",
      },
    ],
  },
];

export const SUPPLIER_FAQ: FaqCategory[] = [
  {
    id: "starten",
    label: "Starten op Vyra",
    entries: [
      {
        id: "sup-starten-aanmelden",
        question: "Hoe meld ik mij aan als leverancier?",
        answer:
          "Via 'Ook leverancier worden?' of het gewone aanmeldformulier (waar je aangeeft dat je wilt aanbieden). Na het aanmaken van je account vul je je bedrijfsprofiel in: bedrijfsnaam, contactpersoon, categorie, werkgebied, beschrijving, prijsindicatie en KVK-nummer. Zodra dat profiel compleet is, kom je op je dashboard terecht en kun je aanvragen ontvangen.",
      },
      {
        id: "sup-starten-proefperiode",
        question: "Hoe werkt de proefperiode precies?",
        answer:
          "Elke nieuwe leverancier krijgt de eerste 3 succesvol afgeronde boekingen volledig gratis, met volledige toegang tot alles wat Vyra te bieden heeft (inclusief functies die zelfs bij het hoogste betaalde niveau niet standaard inbegrepen zijn) en zonder commissie. Na die 3 boekingen val je terug op het abonnementsniveau dat je zelf hebt gekozen (standaard: Instap, gratis met commissie per boeking) — je kunt vóór of na die tijd altijd zelf een ander niveau kiezen via je profiel.",
      },
      {
        id: "sup-starten-beide-rollen",
        question: "Kan ik met hetzelfde account ook zelf evenementen plannen als organisator?",
        answer: "Ja — je wisselt met één klik tussen de leveranciers- en organisatorkant via het knopje in het menu, zonder een tweede account nodig te hebben.",
      },
    ],
  },
  {
    id: "abonnement",
    label: "Abonnement en facturering",
    entries: [
      {
        id: "sup-abo-niveaus",
        question: "Welke abonnementsniveaus zijn er en wat kosten ze?",
        answer:
          "De actuele niveaus, prijzen (maandelijks opzegbaar of voordeliger per jaar) en voorwaarden vind je altijd up-to-date onder 'Abonnement' op je bedrijfsprofiel — dat overzicht toont automatisch de op dit moment geldende bedragen en verschillen per niveau, dus die herhalen we hier bewust niet apart.",
      },
      {
        id: "sup-abo-wisselen",
        question: "Kan ik op elk moment van abonnement wisselen?",
        answer:
          "Ja. Naar Instap (gratis) overstappen kan altijd direct zelf. Naar een ander betaald niveau (of van maandelijks naar jaarlijks) stuurt je naar een beveiligde Stripe-checkout; wissel je tussentijds tussen twee betaalde niveaus, dan wordt het nog ongebruikte deel van je huidige, al betaalde periode automatisch verrekend met de eerste afschrijving van je nieuwe niveau — je betaalt dus nooit dubbel.",
      },
      {
        id: "sup-abo-jaartarief",
        question: "Wat betekent een jaartarief precies — kan ik dat tussentijds opzeggen?",
        answer:
          "Een jaartarief is een verplichting voor de volledige looptijd van één jaar tegen een lagere maandprijs dan het maandelijks opzegbare tarief; het is niet tussentijds op maandbasis opzegbaar en wordt automatisch stilzwijgend verlengd met opnieuw een jaar als je niet uiterlijk één maand van tevoren opzegt. Opzeggen zelf kan altijd via 'Beheer abonnement bij Stripe' op je profiel.",
      },
      {
        id: "sup-abo-opzeggen-verwerkt",
        question: "Als ik opzeg bij Stripe, wordt dat dan ook in Vyra zelf verwerkt?",
        answer: "Ja, automatisch. Zodra Stripe een abonnement daadwerkelijk beëindigt, valt je account zonder verdere handeling terug op Instap — je hoeft dit nergens los door te geven.",
      },
    ],
  },
  {
    id: "aanvragen",
    label: "Aanvragen en offertes",
    entries: [
      {
        id: "sup-aanvragen-reageren",
        question: "Hoeveel tijd heb ik om op een aanvraag te reageren?",
        answer: "In de regel 48 uur — je ziet de resterende tijd per aanvraag op de aanvragenpagina en in het gesprek met de organisator.",
      },
      {
        id: "sup-aanvragen-offerte-maken",
        question: "Hoe stel ik snel een offerte samen?",
        answer:
          "Je typt een korte, stenografische omschrijving (prijs, wat inbegrepen is, personeel/bezorging/opbouw); Vyra structureert dat automatisch tot een volledige offerte die je nog kunt controleren voordat je 'm verstuurt. Vanaf Pro kan VyrAI je omschrijving ook eerst uitschrijven tot volledige offertetekst.",
      },
    ],
  },
  {
    id: "boekingen",
    label: "Boekingen, kalender en analyse",
    entries: [
      {
        id: "sup-boekingen-orders",
        question: "Wat zie ik onder 'Orders'?",
        answer: "Je bevestigde boekingen (geaccepteerde offertes), opgesplitst in aankomend en afgelopen, met betaalstatus, eventuele geschillen, en de mogelijkheid om je orders te exporteren.",
      },
      {
        id: "sup-boekingen-kalender",
        question: "Kan ik mijn Vyra-kalender koppelen aan mijn eigen agenda-app?",
        answer:
          "Ja, onder 'Kalender' vind je een persoonlijke .ics-link die je in je eigen agenda-app kunt abonneren; die toont je bevestigde boekingen en losse geblokkeerde dagen. Let op: terugkerende wekelijkse blokkades tellen wel mee bij matching, maar staan nog niet in deze .ics-feed.",
      },
      {
        id: "sup-boekingen-analyse",
        question: "Wat laat 'Analyse' zien?",
        answer:
          "Hoe je presteert ten opzichte van andere leveranciers in jouw categorie (bijvoorbeeld reactiesnelheid, acceptatiegraad en beoordeling) — hoeveel van die cijfers je te zien krijgt hangt af van je abonnementsniveau. Vanaf een hoger niveau krijg je hier ook automatisch prijsadvies te zien.",
      },
    ],
  },
  {
    id: "vyrai-marketing",
    label: "VyrAI-assistent en marketing",
    entries: [
      {
        id: "sup-vyrai-wat-doet-het",
        question: "Wat kan de VyrAI-assistent voor mij als leverancier?",
        answer:
          "Vanaf Pro: een chatassistent voor vragen over je eigen aanvragen/verdiensten, conceptantwoorden op berichten van organisatoren, en offertehulp. Vanaf Premium komen daar een dagelijkse prioriteitenbriefing, prijsadvies en hulp bij je profieltekst bij. Al deze functies samen tellen mee tegen één gedeelde dagelijkse limiet, die oploopt naarmate je abonnement hoger is.",
      },
      {
        id: "sup-marketing-spotlight",
        question: "Wat doet Spotlight onder 'Marketing'?",
        answer: "Spotlight zet één van je categorieën tijdelijk extra prominent in de openbare zoekresultaten. Hoeveel keer per maand je dit kunt inzetten, hangt af van je abonnementsniveau.",
      },
      {
        id: "sup-marketing-pakketten",
        question: "Wat zijn 'Pakketten' op mijn profiel?",
        answer: "Vaste, kant-en-klare dienstenpakketten (bijvoorbeeld Basis/Standaard/Premium) die je zelf samenstelt en die organisatoren direct als opties op je profiel zien. Beschikbaar vanaf het Pro-abonnement.",
      },
    ],
  },
  {
    id: "hulp",
    label: "Hulp en contact",
    entries: [
      {
        id: "sup-hulp-knop",
        question: "Ik loop tegen iets aan of iets werkt niet — wat nu?",
        answer:
          "Rechtsonder op elke pagina zit een klein rond hulp-icoon. Klik erop en kies 'Ik heb een vraag' of 'Het werkt niet' — je bericht komt direct bij ons binnen. Laat je e-mailadres achter als je een reactie wilt.",
      },
    ],
  },
];

/** Voor de AI-assistent en het zoeken: beide lijsten plat, met welke doelgroep erbij. */
export function flattenFaq(categories: FaqCategory[]): FaqEntry[] {
  return categories.flatMap((c) => c.entries);
}
