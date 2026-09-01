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
 * Leveranciers-abonnementenmodel (spec-item #53, SaaS-pivot, herzien aug.
 * 2026 op verzoek van Cem — zie de toelichting bij SUBSCRIPTION_TIERS
 * hieronder voor wat er precies veranderde en waarom).
 *
 * Elke nieuwe leverancier krijgt eerst `TRIAL_BOOKING_COUNT` succesvolle
 * boekingen volledig gratis, met VOLLEDIGE toegang tot alles wat Vyra te
 * bieden heeft (zie `TRIAL_TIER_DEFINITION`) — zo ervaart een leverancier
 * eerst het volledige platform vóórdat hij een niveau kiest. Zie
 * `resolveEffectiveSupplierTier` in lib/data/store.ts voor hoe dit per
 * leverancier wordt bepaald.
 *
 * Abonnementsgeld EN commissie lopen nu via een echte Stripe-koppeling (zie
 * lib/payments/stripe.ts, app/api/webhooks/stripe/route.ts) — dit is dus
 * geen "mock/pilotfase" meer zoals de rest van dit bestand ooit was.
 */

/** Aantal succesvolle boekingen waarvoor een NIEUWE leverancier volledig gratis, met volledige toegang, kan uitproberen. */
export const TRIAL_BOOKING_COUNT = 3;

export type SubscriptionTier = "instap" | "starter" | "groei" | "pro" | "premium";
/** De proefperiode ("trial") gedraagt zich als een zesde, tijdelijke laag bovenop de vijf echte niveaus. */
export type EffectiveSupplierTier = "trial" | SubscriptionTier;

export const SUBSCRIPTION_TIER_ORDER: SubscriptionTier[] = ["instap", "starter", "groei", "pro", "premium"];

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
 * — 0 voor Instap/Starter/Groei (geen toegang), oplopend voor de twee
 * hoogste niveaus (Pro 1x, Premium 2x per maand). De proefperiode krijgt,
 * net als de rest van het platform (zie TRIAL_TIER_DEFINITION), de hoogste
 * hoeveelheid.
 */
export const SPOTLIGHT_MONTHLY_QUOTA: Record<EffectiveSupplierTier, number> = {
  trial: 4,
  instap: 0,
  starter: 0,
  groei: 0,
  pro: 1,
  premium: 2,
};

export const SUBSCRIPTION_TIER_LABELS: Record<SubscriptionTier, string> = {
  instap: "Instap",
  starter: "Starter",
  groei: "Groei",
  pro: "Pro",
  premium: "Premium",
};

interface CommissionBracket {
  /** null = "en hoger" — de laatste, open schijf. */
  uptoCents: number | null;
  rate: number;
}

/** Eén concreet afschrijvingsbedrag — zie `SubscriptionTierDefinition.billing` hieronder. */
export interface SubscriptionBillingOption {
  /** Bedrag per afschrijving, in centen (bij "annual": het HELE jaarbedrag, niet per maand). */
  priceCents: number;
  /** Weergavetekst, bv. "€59/maand" of "€588/jaar (≈ €49/maand)". */
  priceLabel: string;
}

export interface SubscriptionTierDefinition {
  key: EffectiveSupplierTier;
  label: string;
  /** Korte samenvatting voor kaarten/badges — niet per se letterlijk gelijk aan `billing`, bv. "Gratis + 9% commissie" voor Instap. */
  priceLabel: string;
  /**
   * De twee concrete afschrijvingsopties (spec-item #53-vervolg, aug. 2026:
   * "leveranciers kunnen kiezen voor een abonnement maandtarief die
   * maandelijks opzegbaar is... en dat ze eventueel voor een jaar kunnen
   * tekenen en dan blijven de maandelijkse prijzen staan zoals ze zijn").
   * `monthly` is bewust HOGER dan de vroegere vaste prijs (de "prijs voor
   * flexibiliteit"); `annual` is precies de oude prijs × 12, in één keer
   * per jaar afgeschreven — geen 12 losse maandtermijnen, want dat is de
   * eenvoudigste en betrouwbaarste manier om "een jaar vastzetten tegen het
   * huidige tarief" in Stripe te bouwen zonder zelf een systeem te bouwen
   * dat vroegtijdig opzeggen binnen een jaarafspraak moet blokkeren (zie
   * lib/payments/stripe.ts voor hoe dit als Stripe-price wordt aangemaakt).
   * `null` voor Instap (geen abonnementsprijs, alleen commissie) en de
   * proefperiode (gratis).
   */
  billing: { monthly: SubscriptionBillingOption; annual: SubscriptionBillingOption } | null;
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
   * moet vragen. Was ooit een Enterprise-exclusieve perk; sinds dat niveau
   * verwijderd is (aug. 2026) staat dit voorlopig bij geen enkel betaald
   * niveau meer aan — alleen de proefperiode heeft dit nu nog (zie
   * app/api/cron/supplier-proactive-signals/route.ts).
   */
  assistantProactiveSignals: boolean;
  /** Weergavetekst voor de vergelijkingstabel op het leveranciersprofiel. */
  perks: string[];
}

/** Maximumbedrag aan platformkosten per boeking, ongeacht het gestaffelde tarief hieronder. */
export const COMMISSION_FEE_CAP_CENTS = 40_000; // €400

/**
 * HERZIENING (aug. 2026, op verzoek van Cem — livegang van echte Stripe-
 * facturering): drie wijzigingen t.o.v. het eerdere vijflaags-model.
 *
 * 1) "Enterprise" (voorheen "vanaf €299/maand, op maat") is VERWIJDERD —
 *    Premium blijft het hoogste, vast geprijsde niveau.
 * 2) Nieuw niveau "Instap" toegevoegd, en de nieuwe DEFAULT voor elke
 *    nieuwe leverancier (i.p.v. Starter voorheen) — gratis, geen
 *    abonnementsgeld, een vlakke 9%-commissie per boeking i.p.v. een
 *    gestaffeld tarief. Cems eigen woorden: "veel gebruikers willen eerst
 *    aankijken hoe het platform werkt, om vervolgens een abonnement af te
 *    nemen" — de perks zijn daarom bewust karig (gelijk aan Starters caps,
 *    maar zonder al het andere: geen matching-boost, geen badge, geen
 *    pakketten, geen VyrAI) zodat een groeiende leverancier al snel voordeel
 *    ziet in overstappen op een abonnement.
 * 3) Starter/Groei/Pro/Premium hebben nu elk TWEE prijzen (zie `billing`
 *    hierboven) i.p.v. één: maandelijks opzegbaar (hoger dan de oude vaste
 *    prijs) of een jaarafspraak (= de oude prijs, nu als jaarbedrag).
 */
export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, SubscriptionTierDefinition> = {
  instap: {
    key: "instap",
    label: "Instap",
    priceLabel: "Gratis + 9% commissie",
    billing: null,
    tagline: "Geen abonnementskosten — probeer Vyra eerst uit, betaal alleen per boeking.",
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
    commissionTiers: [{ uptoCents: null, rate: 0.09 }], // vlak 9%, geen schijven
    assistantTier: 0,
    assistantDailyLimit: 0,
    assistantProactiveSignals: false,
    perks: [
      "Geen abonnementskosten",
      "1 categorie",
      "Tot 3 foto's in je profiel",
      "Werkgebied tot 25 km",
      "Onbeperkt reageren op aanvragen",
      "9% commissie per boeking",
    ],
  },
  starter: {
    key: "starter",
    label: "Starter",
    priceLabel: "Vanaf €49/maand",
    billing: {
      monthly: { priceCents: 5_900, priceLabel: "€59/maand" },
      annual: { priceCents: 58_800, priceLabel: "€588/jaar (≈ €49/maand)" },
    },
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
    priceLabel: "Vanaf €79/maand",
    billing: {
      monthly: { priceCents: 9_500, priceLabel: "€95/maand" },
      annual: { priceCents: 94_800, priceLabel: "€948/jaar (≈ €79/maand)" },
    },
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
    priceLabel: "Vanaf €129/maand",
    billing: {
      monthly: { priceCents: 15_500, priceLabel: "€155/maand" },
      annual: { priceCents: 154_800, priceLabel: "€1.548/jaar (≈ €129/maand)" },
    },
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
    priceLabel: "Vanaf €199/maand",
    billing: {
      monthly: { priceCents: 23_900, priceLabel: "€239/maand" },
      annual: { priceCents: 238_800, priceLabel: "€2.388/jaar (≈ €199/maand)" },
    },
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
};

/**
 * Wat een leverancier tijdens de proefperiode krijgt: het volledige
 * platform (zodat hij alles kan ervaren vóórdat hij een abonnement kiest,
 * zie de toelichting hierboven), inclusief functies die zelfs Premium (het
 * hoogste betaalde niveau) niet heeft — maar zonder badge, die hoort bij
 * een echt gekozen (en straks betaald) abonnement — en met 0% commissie.
 */
export const TRIAL_TIER_DEFINITION: SubscriptionTierDefinition = {
  key: "trial",
  label: "Proefperiode",
  priceLabel: "Gratis",
  billing: null,
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
    "Volledige toegang tot alle functies, zodat je eerst kunt ervaren wat Vyra voor je kan doen",
  ],
};

export function getEffectiveTierDefinition(tier: EffectiveSupplierTier): SubscriptionTierDefinition {
  if (tier === "trial") return TRIAL_TIER_DEFINITION;
  // `?? SUBSCRIPTION_TIERS.premium`: vangnet voor een niet (meer) bestaande
  // waarde uit de database (bv. een oude "enterprise"-rij, van vóór dat
  // niveau verwijderd werd, aug. 2026) — nooit crashen op verouderde data,
  // val terug op het hoogste nog bestaande niveau i.p.v. `undefined`.
  return SUBSCRIPTION_TIERS[tier] ?? SUBSCRIPTION_TIERS.premium;
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

/**
 * Of er een compleet Stripe-sleutelpaar geconfigureerd is. Vandaag nog
 * NERGENS in de app gelezen: dit is puur voorbereiding voor een echte
 * betaalflow (spec-item #132, zie supabase/migrations/0049_stripe_payment_prep.sql
 * en app/api/webhooks/stripe/route.ts). De organisator rekent op dit
 * moment altijd rechtstreeks af met de leverancier — zie de toelichting op
 * de checkoutpagina (app/events/[id]/checkout/[paymentId]/page.tsx) voor
 * waarom dat bewust zo is, en niet stilzwijgend "Stripe" toont zonder dat
 * er ooit een betaling wordt verwerkt. Vereist alledrie de Stripe-env-vars
 * (niet alleen de secret key) omdat pas met alledrie een échte checkout +
 * webhook-verwerking mogelijk is.
 */
export const PAYMENTS_ENABLED = Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && process.env.STRIPE_WEBHOOK_SECRET);

/**
 * Gastenfoto-pagina per evenement ("Deel C", sep. 2026 op verzoek van Cem):
 * een eigen, deelbare webpagina per evenement waar gasten via een link/QR
 * rechtstreeks foto's (en bij Premium video's) kunnen uploaden — geen
 * hashtag-verzamelaar (onbetrouwbaar/onmogelijk zonder officiële
 * Instagram-API-toegang voor een klein platform als Vyra), gewoon direct
 * uploaden. Eenmalig bedrag per evenement, geen abonnement — dit is een
 * losstaand extraatje bovenop het gewone Vyra-gebruik, geen leveranciers-
 * niveau. Prijzen/perks definitief afgestemd met Cem (zie changelog):
 *  - Basis  €49 — 60 dagen zichtbaar, onbeperkt foto's, moderatie vooraf.
 *  - Plus   €79 — half jaar zichtbaar, + gastenboek-berichten, album als
 *           zip downloaden, eigen kleurthema.
 *  - Premium €99 — heel jaar zichtbaar, + video's, fotoboek-PDF, kiezen uit
 *           uitnodigingssjablonen, grotere bestanden toegestaan.
 * Elk niveau bevat alles van het niveau eronder.
 */
export type GalleryTier = "basis" | "plus" | "premium";

export interface GalleryTierDefinition {
  tier: GalleryTier;
  label: string;
  priceCents: number;
  /** Aantal dagen na de evenementdatum dat de gastenfoto-pagina zichtbaar blijft voor de organisator wordt opgeruimd (zie de dagelijkse opschoon-cron). */
  retentionDays: number;
  perks: string[];
  allowVideo: boolean;
  allowGuestbook: boolean;
  allowZipDownload: boolean;
  allowCustomTheme: boolean;
  allowInvitationTemplates: boolean;
  /** Maximale bestandsgrootte per upload, in MB — server-side afgedwongen in lib/data/store.ts (uploadGalleryMedia). */
  maxUploadMb: number;
}

export const GALLERY_TIER_ORDER: GalleryTier[] = ["basis", "plus", "premium"];

export const GALLERY_TIERS: Record<GalleryTier, GalleryTierDefinition> = {
  basis: {
    tier: "basis",
    label: "Basis",
    priceCents: 4900,
    retentionDays: 60,
    perks: ["Onbeperkt foto's uploaden", "60 dagen zichtbaar voor gasten", "Foto's worden vóór publicatie beoordeeld"],
    allowVideo: false,
    allowGuestbook: false,
    allowZipDownload: false,
    allowCustomTheme: false,
    allowInvitationTemplates: false,
    maxUploadMb: 15,
  },
  plus: {
    tier: "plus",
    label: "Plus",
    priceCents: 7900,
    retentionDays: 182,
    perks: ["Alles van Basis", "Half jaar zichtbaar voor gasten", "Gastenboek-berichten van gasten", "Volledig album downloaden (zip)", "Eigen kleurthema"],
    allowVideo: false,
    allowGuestbook: true,
    allowZipDownload: true,
    allowCustomTheme: true,
    allowInvitationTemplates: false,
    maxUploadMb: 15,
  },
  premium: {
    tier: "premium",
    label: "Premium",
    priceCents: 9900,
    retentionDays: 365,
    perks: ["Alles van Plus", "Een heel jaar zichtbaar voor gasten", "Ook video's uploaden", "Fotoboek als PDF", "Kies uit uitnodigingssjablonen", "Grotere bestanden toegestaan"],
    allowVideo: true,
    allowGuestbook: true,
    allowZipDownload: true,
    allowCustomTheme: true,
    allowInvitationTemplates: true,
    // Bewust NIET de volle "grotere bestanden"-belofte (bv. 100MB) — de
    // Server Action-uploadgrens staat in next.config.ts op 20mb (zelfde
    // grens die eerder de leveranciersprofiel-foto-upload liet mislukken
    // totdat die van 1MB naar 20mb werd opgehoogd). 18MB laat ruim marge
    // onder die grens (multipart-overhead meegerekend) i.p.v. blindelings
    // een grotere waarde te beloven die stil kan mislukken — "groter dan
    // Basis/Plus" (15MB) blijft wel waar. Wil je hier écht grotere
    // video's toestaan, dan moet eerst bodySizeLimit in next.config.ts
    // omhoog (en getest worden dat Vercel dat ook daadwerkelijk toelaat).
    maxUploadMb: 18,
  },
};

/** Zelfde "graceful fallback zonder sleutels"-patroon als PAYMENTS_ENABLED hierboven — de aankooppagina toont dan een nette melding i.p.v. een kale Stripe-fout. */
export const GALLERY_PURCHASE_ENABLED = PAYMENTS_ENABLED;

/**
 * Of er e-mailmeldingen worden verstuurd (nieuwe aanvraag, nieuwe offerte,
 * verlopen reactietermijn) naast de bestaande in-app-meldingen. Zonder
 * RESEND_API_KEY blijft de app volledig werken, alleen dan zonder e-mail —
 * zelfde "graceful fallback"-patroon als AI_ENABLED/PAYMENTS_ENABLED. Zie
 * lib/email/send.ts.
 */
export const EMAIL_ENABLED = Boolean(process.env.RESEND_API_KEY);

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Vyra <onboarding@resend.dev>";

/**
 * Of er browser-pushmeldingen kunnen worden verstuurd (spec-item #131:
 * e-mail/push bij proactieve signalen), naast de bestaande
 * in-app-meldingen en e-mail. Vereist een zelf-gegenereerd VAPID-sleutelpaar
 * (GEEN account bij een externe partij nodig, in tegenstelling tot bv.
 * Stripe/Resend — het is puur een cryptografisch sleutelpaar). De publieke
 * sleutel staat bewust als NEXT_PUBLIC_-variabele (ook clientside nodig voor
 * `PushManager.subscribe`) — dat is prima ook server-side te lezen, dus één
 * variabele voor beide kanten i.p.v. 'm dubbel te definiëren. Zonder deze
 * sleutels blijft de app volledig werken, alleen dan zonder push — zelfde
 * "graceful fallback"-patroon als EMAIL_ENABLED hierboven. Zie lib/push.ts.
 */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const PUSH_ENABLED = Boolean(VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/**
 * Volledige site-URL, voor absolute links in e-mails, Stripe-terugkeer-URL's
 * en Supabase Auth-redirects (relatieve links werken niet in een
 * mailclient, en zowel Stripe-webhooks als Supabase's redirect-allowlist
 * hebben één vaste, kloppende waarde nodig).
 *
 * BEWUST "https://www.vyra.now" (mét www), NIET de kale "https://vyra.now":
 * die laatste stuurt zelf 308-door naar de www-versie (Vercel-domeinconfig).
 * Een browser volgt zo'n doorverwijzing onopvallend mee, maar Stripe's
 * webhook-aflevering volgt REDIRECTS EXPLICIET NIET (Stripe's eigen
 * documentatie: "we consider redirect responses to webhook requests as
 * failures") — elke Stripe-webhook naar een op de kale domeinnaam
 * geregistreerd endpoint faalt daardoor altijd, ook al lijkt de rest van de
 * betaalflow (checkout, terugkeer-URL) gewoon te werken. Ontdekt sep. 2026
 * toen zowel de gastenfoto-betaling ALS (met terugwerkende kracht, te zien
 * aan de bestaande 308-foutmeldingen in Stripe's webhooklogboek) de
 * leveranciers-abonnementen-webhook hierdoor nooit activeerden. Zie ook de
 * soortgelijke ontdekking bij CRON_SECRET-curl-tests eerder dit project.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.vyra.now";

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
 * lib/data/store.ts. Voor Pro/Premium (en de proefperiode) is dat
 * tarief een enkele schijf van 0%, dus dan komt hier altijd 0 platformkosten
 * uit — dezelfde functie werkt voor alle niveaus, geen aparte "pro"-tak meer
 * nodig.
 *
 * `rate` in het resultaat is het EFFECTIEVE (gemiddelde) percentage over het
 * hele bedrag — bij een gestaffeld tarief dus niet gelijk aan één van de
 * schijfpercentages, maar de blend ervan (handig voor weergave, bv.
 * "Platformkosten (4,1%)" op de afrekenpagina).
 */
export function calculateCommission(supplierAmountInCents: number, tier: EffectiveSupplierTier = "instap") {
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
