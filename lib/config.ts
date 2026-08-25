/**
 * Centrale platformconfiguratie.
 *
 * Belangrijk: bedrijfsregels zoals het commissiemodel staan hier op één
 * plek. Nergens anders in de applicatie mag een percentage hardcoded
 * worden. Dit maakt het later triviaal om tarieven te wijzigen, per
 * leverancierscategorie te differentiëren, of A/B te testen — zonder de
 * rest van de applicatie aan te raken.
 */

/**
 * Leveranciers-abonnementenmodel (spec-item #53, SaaS-pivot) — vervangt het
 * eerdere drielaags-commissiemodel (instap/gestaffeld/Pro). Reden: commissie
 * innen vereist dat je het geld even vasthoudt, wat pas kan zodra er een
 * echte betaaldienst is aangesloten; een abonnement is een vast, terugkerend
 * bedrag dat de leverancier zelf betaalt, los van hoe een boeking daarna
 * wordt afgerekend — dat is nu al te innen (zie SUBSCRIPTION_TIERS
 * hieronder voor hoe, via Stripe Payment Links).
 *
 * Prijstrede: elk niveau kost ~1,5–1,6x het vorige (49 → 79 → 129 → 199 →
 * 299), een bewust AFNEMENDE verhouding i.p.v. de eerdere reeks die steeds
 * ongeveer verdubbelde (49 → 99 → 199 → 349 → 599) — die voelde voor een
 * leverancier "exponentieel" duurder bij elke stap. Met een constante,
 * lichtjes dalende factor blijft elke upgrade een herkenbare, uit te leggen
 * stap ("een derde duurder voor dit extra"), i.p.v. een sprong die steeds
 * groter aanvoelt.
 *
 * Elke nieuwe leverancier krijgt eerst `TRIAL_BOOKING_COUNT` succesvolle
 * boekingen volledig gratis, met VOLLEDIGE toegang tot alles wat Vyra te
 * bieden heeft (zie `TRIAL_TIER_DEFINITION`) — zo ervaart een leverancier
 * eerst het volledige platform vóórdat hij een abonnement kiest. Daarna kiest
 * hij een van de vijf niveaus hieronder. Zie `resolveEffectiveSupplierTier`
 * in lib/data/store.ts voor hoe dit per leverancier wordt bepaald.
 *
 * Belangrijk: abonnementsgeld wordt nog handmatig/self-service geregeld (via
 * een Stripe Payment Link die je zelf aanmaakt, zie het leveranciersprofiel)
 * — er is nog GEEN automatische incasso. Zelfde eerlijke "mock/pilotfase"-
 * aanpak als de rest van de betaalflow in deze app.
 */

/** Aantal succesvolle boekingen waarvoor een NIEUWE leverancier volledig gratis, met volledige toegang, kan uitproberen. */
export const TRIAL_BOOKING_COUNT = 3;

export type SubscriptionTier = "starter" | "groei" | "pro" | "premium" | "enterprise";
/** De proefperiode ("trial") gedraagt zich als een zesde, tijdelijke laag bovenop de vijf echte abonnementen. */
export type EffectiveSupplierTier = "trial" | SubscriptionTier;

export const SUBSCRIPTION_TIER_ORDER: SubscriptionTier[] = ["starter", "groei", "pro", "premium", "enterprise"];

/** Hoeveel dagen een geactiveerde "spotlight" actief blijft — zie lib/data/store.ts (activateSpotlight, getActiveSpotlightsForSupplier). */
export const SPOTLIGHT_DURATION_DAYS = 3;

/**
 * Wederzijdse beoordelingen blijven voor de tegenpartij verborgen tot
 * allebei hebben ingevuld, óf tot dit aantal dagen na de evenementdatum is
 * verstreken — zodat een review niet eeuwig kan blijven hangen als de
 * andere kant nooit reageert. Zelfde 14-dagen-venster als Airbnb. Zie
 * isReviewRevealed() in lib/utils.ts.
 */
export const REVIEW_REVEAL_WINDOW_DAYS = 14;

/**
 * Hoeveel spotlights een leverancier per kalendermaand gratis mag activeren
 * — 0 voor Starter/Groei (geen toegang), oplopend voor de drie hoogste
 * niveaus (op verzoek: Pro 1x, Premium 2x, Enterprise 4x per maand). De
 * proefperiode krijgt, net als de rest van het platform (zie
 * TRIAL_TIER_DEFINITION), de Enterprise-hoeveelheid.
 */
export const SPOTLIGHT_MONTHLY_QUOTA: Record<EffectiveSupplierTier, number> = {
  trial: 4,
  starter: 0,
  groei: 0,
  pro: 1,
  premium: 2,
  enterprise: 4,
};

export const SUBSCRIPTION_TIER_LABELS: Record<SubscriptionTier, string> = {
  starter: "Starter",
  groei: "Groei",
  pro: "Pro",
  premium: "Premium",
  enterprise: "Enterprise",
};

interface CommissionBracket {
  /** null = "en hoger" — de laatste, open schijf. */
  uptoCents: number | null;
  rate: number;
}

export interface SubscriptionTierDefinition {
  key: EffectiveSupplierTier;
  label: string;
  /** null = geen vaste prijs (Enterprise: op maat). */
  priceCents: number | null;
  priceLabel: string;
  tagline: string;
  /** null = onbeperkt. */
  maxCategories: number | null;
  /** null = onbeperkt. */
  maxGalleryPhotos: number | null;
  /** null = onbeperkt. */
  maxServiceRadiusKm: number | null;
  /** Additieve score-boost in de matching (zie findRealMatchingSuppliers in lib/data/store.ts). */
  matchingBoost: number;
  /** Harde sorteer-override: altijd bovenaan binnen categorie/regio, ongeacht score (niet kans-gebaseerd). */
  guaranteedTopPosition: boolean;
  /** Hoeveel benchmark-statistieken (t.o.v. het categoriegemiddelde) zichtbaar zijn op het leveranciersprofiel. */
  insightMetrics: 0 | 1 | 3;
  badge: "none" | "aanbevolen" | "elite";
  personalSupportLine: boolean;
  dedicatedAccountManager: boolean;
  /** Pakketten (Basis/Standaard/Premium) op het profiel — zie SupplierPackage in lib/types.ts. */
  packagesEnabled: boolean;
  /** "Profiel aankleden" — hoe hoger het abonnement, hoe meer hiervan beschikbaar is (zie SupplierAccount.tagline/coverPhotoUrl/introVideoUrl). */
  taglineEnabled: boolean;
  coverPhotoEnabled: boolean;
  introVideoEnabled: boolean;
  /** Progressief, net als belastingschijven — elk deel van het boekingsbedrag valt in zijn eigen schijf. */
  commissionTiers: CommissionBracket[];
  /**
   * VyrAI-assistent voor leveranciers (spec-item #57, aug. 2026) — zelfde
   * oplopende-niveau-idioom als `insightMetrics` hierboven. 0 = geen
   * toegang (Starter/Groei). 1 = basis: chatassistent, conceptantwoorden op
   * berichten, offertehulp (Pro). 2 = alles van 1 plus dagelijkse
   * prioriteitenbriefing, prijsadvies en profieltekst-hulp (Premium en
   * hoger). Zie lib/ai/supplierAssistant.ts en de losse features in
   * lib/ai/ voor waar dit precies op wordt gecontroleerd.
   */
  assistantTier: 0 | 1 | 2;
  /**
   * Maximum aantal VyrAI-assistent-aanroepen per kalenderdag (alle
   * assistant-features samen — chat, conceptantwoord, offertehulp,
   * briefing, prijsadvies, profieltekst-hulp tellen allemaal mee). `null` =
   * onbeperkt. Zie lib/ai/supplierAssistantLimit.ts.
   */
  assistantDailyLimit: number | null;
  /**
   * "Proactieve signalen" — VyrAI seint zelf (via de bestaande
   * notificatie-infrastructuur) als een lead dreigt te verlopen of een
   * gesprek al een tijd stilligt, i.p.v. dat de leverancier er zelf naar
   * moet vragen. Alleen Enterprise (en de proefperiode).
   */
  assistantProactiveSignals: boolean;
  /** Weergavetekst voor de vergelijkingstabel op het leveranciersprofiel. */
  perks: string[];
}

/** Maximumbedrag aan platformkosten per boeking, ongeacht het gestaffelde tarief hieronder. */
export const COMMISSION_FEE_CAP_CENTS = 40_000; // €400

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, SubscriptionTierDefinition> = {
  starter: {
    key: "starter",
    label: "Starter",
    priceCents: 4_900,
    priceLabel: "€49/maand",
    tagline: "Om te beginnen — één categorie, altijd zichtbaar in matching.",
    maxCategories: 1,
    maxGalleryPhotos: 3,
    maxServiceRadiusKm: 25,
    matchingBoost: 0,
    guaranteedTopPosition: false,
    insightMetrics: 0,
    badge: "none",
    personalSupportLine: false,
    dedicatedAccountManager: false,
    packagesEnabled: false,
    taglineEnabled: false,
    coverPhotoEnabled: false,
    introVideoEnabled: false,
    commissionTiers: [
      { uptoCents: 50_000, rate: 0.06 }, // €0 – €500: 6%
      { uptoCents: 200_000, rate: 0.045 }, // €500 – €2.000: 4,5%
      { uptoCents: 1_000_000, rate: 0.03 }, // €2.000 – €10.000: 3%
      { uptoCents: null, rate: 0.02 }, // > €10.000: 2%
    ],
    assistantTier: 0,
    assistantDailyLimit: 0,
    assistantProactiveSignals: false,
    perks: [
      "1 categorie",
      "Tot 3 foto's in je profiel",
      "Werkgebied tot 25 km",
      "Onbeperkt reageren op aanvragen",
      "Gestaffelde commissie (6% → 2%, afhankelijk van het boekingsbedrag)",
    ],
  },
  groei: {
    key: "groei",
    label: "Groei",
    priceCents: 7_900,
    priceLabel: "€79/maand",
    tagline: "Meer categorieën, meer zichtbaarheid, minder commissie.",
    maxCategories: 3,
    maxGalleryPhotos: 10,
    maxServiceRadiusKm: 50,
    matchingBoost: 10,
    guaranteedTopPosition: false,
    insightMetrics: 1,
    badge: "none",
    personalSupportLine: false,
    dedicatedAccountManager: false,
    packagesEnabled: false,
    taglineEnabled: true,
    coverPhotoEnabled: false,
    introVideoEnabled: false,
    commissionTiers: [
      { uptoCents: 50_000, rate: 0.04 },
      { uptoCents: 200_000, rate: 0.03 },
      { uptoCents: 1_000_000, rate: 0.02 },
      { uptoCents: null, rate: 0.01 },
    ],
    assistantTier: 0,
    assistantDailyLimit: 0,
    assistantProactiveSignals: false,
    perks: [
      "Tot 3 categorieën",
      "Tot 10 foto's in je profiel",
      "Werkgebied tot 50 km",
      "Hogere positie in de matching",
      "Inzicht: je reactiesnelheid t.o.v. je categoriegemiddelde",
      "Korte pitch/tagline op je profiel",
      "Verlaagde gestaffelde commissie (4% → 1%)",
    ],
  },
  pro: {
    key: "pro",
    label: "Pro",
    priceCents: 12_900,
    priceLabel: "€129/maand",
    tagline: "Uitgelicht profiel, geen commissie meer.",
    maxCategories: null,
    maxGalleryPhotos: null,
    maxServiceRadiusKm: 100,
    matchingBoost: 20,
    guaranteedTopPosition: false,
    insightMetrics: 3,
    badge: "aanbevolen",
    personalSupportLine: false,
    dedicatedAccountManager: false,
    packagesEnabled: true,
    taglineEnabled: true,
    coverPhotoEnabled: true,
    introVideoEnabled: false,
    commissionTiers: [{ uptoCents: null, rate: 0 }],
    // 30/dag: ruim genoeg voor een paar chatvragen + conceptantwoorden +
    // offertehulp per werkdag, zonder dat het aanvoelt als een harde muur —
    // zie lib/ai/supplierAssistantLimit.ts voor hoe dit geteld wordt.
    assistantTier: 1,
    assistantDailyLimit: 30,
    assistantProactiveSignals: false,
    perks: [
      "Onbeperkt categorieën",
      "Onbeperkt foto's",
      "Werkgebied tot 100 km",
      "\"Aanbevolen\"-badge op je profiel en in matching",
      "Sterkere positie in de matching",
      "Volledig inzicht: reactiesnelheid, acceptatiegraad én beoordeling t.o.v. je categoriegemiddelde",
      "Pakketten (Basis/Standaard/Premium) op je profiel",
      "Coverfoto boven je profiel",
      "0% commissie op boekingen",
      "VyrAI-assistent: chat, conceptantwoorden en offertehulp",
    ],
  },
  premium: {
    key: "premium",
    label: "Premium",
    priceCents: 19_900,
    priceLabel: "€199/maand",
    tagline: "Gegarandeerd bovenaan, met persoonlijke ondersteuning.",
    maxCategories: null,
    maxGalleryPhotos: null,
    maxServiceRadiusKm: 150,
    matchingBoost: 20,
    guaranteedTopPosition: true,
    insightMetrics: 3,
    badge: "elite",
    personalSupportLine: true,
    dedicatedAccountManager: false,
    packagesEnabled: true,
    taglineEnabled: true,
    coverPhotoEnabled: true,
    introVideoEnabled: true,
    commissionTiers: [{ uptoCents: null, rate: 0 }],
    // 75/dag: ~2,5x de Pro-limiet, in lijn met de bredere featureset
    // (briefing + prijsadvies + profieltekst-hulp komen erbij).
    assistantTier: 2,
    assistantDailyLimit: 75,
    assistantProactiveSignals: false,
    perks: [
      "Alles van Pro",
      "Gegarandeerd bovenaan bij matching binnen je categorie en regio",
      "\"Vyra Elite Partner\"-badge",
      "Werkgebied tot 150 km",
      "Persoonlijke supportlijn",
      "Introductievideo op je profiel",
      "0% commissie op boekingen",
      "VyrAI-assistent: ook dagelijkse briefing, prijsadvies en profieltekst-hulp",
    ],
  },
  enterprise: {
    key: "enterprise",
    label: "Enterprise",
    priceCents: null,
    priceLabel: "Vanaf €299/maand, op maat",
    tagline: "Voor grote, veelboekende leveranciers — op maat.",
    maxCategories: null,
    maxGalleryPhotos: null,
    maxServiceRadiusKm: null,
    matchingBoost: 20,
    guaranteedTopPosition: true,
    insightMetrics: 3,
    badge: "elite",
    personalSupportLine: true,
    dedicatedAccountManager: true,
    packagesEnabled: true,
    taglineEnabled: true,
    coverPhotoEnabled: true,
    introVideoEnabled: true,
    commissionTiers: [{ uptoCents: null, rate: 0 }],
    assistantTier: 2,
    assistantDailyLimit: null,
    assistantProactiveSignals: true,
    perks: [
      "Alles van Premium",
      "Onbeperkt werkgebied",
      "Dedicated accountmanager",
      "Rapportages op aanvraag",
      "Maatwerkafspraken mogelijk",
      "0% commissie op boekingen",
      "VyrAI-assistent zonder dagelijkse limiet + proactieve signalen",
    ],
  },
};

/**
 * Wat een leverancier tijdens de proefperiode krijgt: dezelfde perks als
 * Enterprise (zodat hij het volledige platform kan ervaren vóórdat hij een
 * abonnement kiest, zie de toelichting hierboven), maar zonder badge — die
 * hoort bij een echt gekozen (en straks betaald) abonnement — en met 0%
 * commissie.
 */
export const TRIAL_TIER_DEFINITION: SubscriptionTierDefinition = {
  key: "trial",
  label: "Proefperiode",
  priceCents: null,
  priceLabel: "Gratis",
  tagline: `Je eerste ${TRIAL_BOOKING_COUNT} boekingen — met volledige toegang tot alles wat Vyra te bieden heeft.`,
  maxCategories: null,
  maxGalleryPhotos: null,
  maxServiceRadiusKm: null,
  matchingBoost: 20,
  guaranteedTopPosition: true,
  insightMetrics: 3,
  badge: "none",
  personalSupportLine: true,
  dedicatedAccountManager: false,
  packagesEnabled: true,
  taglineEnabled: true,
  coverPhotoEnabled: true,
  introVideoEnabled: true,
  commissionTiers: [{ uptoCents: null, rate: 0 }],
  assistantTier: 2,
  assistantDailyLimit: null,
  assistantProactiveSignals: true,
  perks: [
    `Je eerste ${TRIAL_BOOKING_COUNT} boekingen volledig gratis, 0% commissie`,
    "Volledige toegang tot alle Enterprise-functies, zodat je eerst kunt ervaren wat Vyra voor je kan doen",
  ],
};

export function getEffectiveTierDefinition(tier: EffectiveSupplierTier): SubscriptionTierDefinition {
  return tier === "trial" ? TRIAL_TIER_DEFINITION : SUBSCRIPTION_TIERS[tier];
}

/**
 * Harde bovengrens op het aantal vervolgvragen dat het AI-interview
 * (`generateNextQuestion` in lib/ai/interview.ts) mag stellen bij het
 * starten van een nieuw evenement — spec-item #56 (gemeld: het gesprek
 * leek geen einde te nemen). De AI-prompt kreeg al eerder de instructie om
 * na "meestal 4-7 vragen" te stoppen, maar dat is slechts een suggestie die
 * de AI naar eigen inzicht kan negeren — deze constante wordt in CODE
 * afgedwongen (`generateNextQuestion` forceert `done: true` zodra dit
 * aantal al gestelde vragen is bereikt, zonder de AI nog te hoeven
 * raadplegen), dezelfde "nooit alleen op de AI vertrouwen voor een harde
 * grens"-aanpak als overal elders in dit bestand. Ook client-side gebruikt
 * (NewEventInterview.tsx) om vooraf aan te geven hoeveel vragen er
 * maximaal volgen — één bron van waarheid voor beide kanten.
 */
export const MAX_INTERVIEW_QUESTIONS = 6;

export const SUPPLIER_RESPONSE_WINDOW_HOURS = 48;

/**
 * Aantal dagen zonder wijziging aan een evenement (nog niet "confirmed",
 * "completed" of "cancelled") voordat het AI-team dit als "lijkt
 * stilgevallen" signaleert in het dagrapport (zie
 * generateAndStoreDailyBriefing() in lib/data/store.ts). Puur
 * informatief — geen automatische actie, alleen een seintje dat Cem
 * eventueel zelf even kan navragen bij de organisator.
 */
export const ORGANIZER_STALLED_DAYS = 7;

/**
 * Standaardpercentage voor een aanbetaling wanneer een organisator kiest om
 * een offerte in delen te betalen (aanbetaling nu, restbedrag later) in
 * plaats van in één keer. Zie createPaymentForOffer() in lib/data/store.ts.
 */
export const DEFAULT_DEPOSIT_PERCENT = 0.3; // 30% aanbetaling, 70% restbedrag

export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_LOCALE = "nl-NL";
export const DEFAULT_COUNTRY = "NL";

/** Aantal leveranciers dat standaard per aanvraag wordt benaderd (anti-spam). */
export const SUPPLIERS_PER_REQUEST = { min: 3, max: 5 };

/**
 * Of er een echte AI-provider is geconfigureerd. Als dit false is, valt de
 * hele AI-laag terug op deterministische mock-logica zodat de app zonder
 * API-key volledig te demonstreren blijft. Zie lib/ai/client.ts.
 *
 * Vyra gebruikt Claude (Anthropic) als AI-provider — zet ANTHROPIC_API_KEY
 * in .env.local (zie .env.example) om echte AI-aanroepen te activeren.
 */
export const AI_ENABLED = Boolean(process.env.ANTHROPIC_API_KEY);

export const PAYMENTS_ENABLED = Boolean(process.env.STRIPE_SECRET_KEY);

/**
 * Of er e-mailmeldingen worden verstuurd (nieuwe aanvraag, nieuwe offerte,
 * verlopen reactietermijn) naast de bestaande in-app-meldingen. Zonder
 * RESEND_API_KEY blijft de app volledig werken, alleen dan zonder e-mail —
 * zelfde "graceful fallback"-patroon als AI_ENABLED/PAYMENTS_ENABLED. Zie
 * lib/email/send.ts.
 */
export const EMAIL_ENABLED = Boolean(process.env.RESEND_API_KEY);

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Vyra <onboarding@resend.dev>";

/** Volledige site-URL, voor absolute links in e-mails (relatieve links werken niet in een mailclient). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vyra.now";

/**
 * E-mailadres(sen) die toegang hebben tot /admin. Alleen deze gebruiker(s)
 * kunnen het platformbrede admin-dashboard zien — iedereen anders wordt
 * doorgestuurd. Zet hier je eigen e-mailadres; meerdere adressen kan met
 * een komma-gescheiden lijst in ADMIN_EMAILS (env var), als fallback wordt
 * onderstaand adres gebruikt.
 *
 * Bugfix (spec-item #52): de fallback stond nog op cemadiyaman91@gmail.com,
 * maar Cems echte Vyra-account (waarmee hij live inlogt) gebruikt
 * cemadiyaman@hotmail.nl — daardoor werd hij op /admin altijd stilzwijgend
 * teruggestuurd naar /events, zonder foutmelding, alsof de pagina niet
 * bestond. Beide adressen staan nu in de fallback zodat dit niet nogmaals
 * per ongeluk kan gebeuren als er ooit met een ander account wordt
 * ingelogd.
 */
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "cemadiyaman@hotmail.nl,cemadiyaman91@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function formatCurrency(
  amountInCents: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountInCents / 100);
}

/**
 * Berekent de platformkosten voor een boeking, volgens het gestaffelde
 * tarief van het abonnementsniveau (of de proefperiode) dat op dít moment
 * voor déze leverancier geldt — zie `resolveEffectiveSupplierTier` in
 * lib/data/store.ts. Voor Pro/Premium/Enterprise (en de proefperiode) is dat
 * tarief een enkele schijf van 0%, dus dan komt hier altijd 0 platformkosten
 * uit — dezelfde functie werkt voor alle niveaus, geen aparte "pro"-tak meer
 * nodig.
 *
 * `rate` in het resultaat is het EFFECTIEVE (gemiddelde) percentage over het
 * hele bedrag — bij een gestaffeld tarief dus niet gelijk aan één van de
 * schijfpercentages, maar de blend ervan (handig voor weergave, bv.
 * "Platformkosten (4,1%)" op de afrekenpagina).
 */
export function calculateCommission(supplierAmountInCents: number, tier: EffectiveSupplierTier = "starter") {
  const definition = getEffectiveTierDefinition(tier);
  let remaining = supplierAmountInCents;
  let lowerBoundCents = 0;
  let feeCents = 0;
  for (const bracket of definition.commissionTiers) {
    const upperBoundCents = bracket.uptoCents ?? Infinity;
    const amountInBracket = Math.max(0, Math.min(remaining, upperBoundCents - lowerBoundCents));
    feeCents += amountInBracket * bracket.rate;
    remaining -= amountInBracket;
    lowerBoundCents = upperBoundCents;
    if (remaining <= 0) break;
  }
  const platformFee = Math.min(Math.round(feeCents), COMMISSION_FEE_CAP_CENTS);
  const rate = supplierAmountInCents > 0 ? platformFee / supplierAmountInCents : 0;
  return { supplierAmount: supplierAmountInCents, platformFee, total: supplierAmountInCents + platformFee, rate, tier };
}
