/**
 * Centraal datamodel voor het platform.
 *
 * Ontwerpregel (zie productspec §57): we maken expliciet onderscheid tussen
 * USER DATA, EVENT DATA, AI GENERATED DATA, SUPPLIER DATA en TRANSACTION DATA.
 * AI-gegenereerde informatie wordt nooit opgeslagen alsof deze door de
 * gebruiker of leverancier is bevestigd — vandaar het `Provenance`-type dat
 * overal wordt meegegeven waar dat onderscheid ertoe doet.
 */

import type { GalleryTier, SubscriptionTier } from "@/lib/config";

export type Provenance = "user" | "ai_recommendation" | "supplier" | "system";

export interface AttributedValue<T> {
  value: T;
  source: Provenance;
  /** Alleen relevant bij source = ai_recommendation: korte uitleg waarom. */
  rationale?: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* USER DATA                                                          */
/* ------------------------------------------------------------------ */

export type UserRole = "customer" | "supplier" | "both" | "admin";

/** Eén bron van waarheid voor het label per rol — gebruikt in /profile (zelf wijzigen) en /admin/gebruikers (overzicht). */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  customer: "Organisator",
  supplier: "Leverancier",
  both: "Organisator + leverancier",
  admin: "Admin",
};

export interface UserAccount {
  id: string;
  role: UserRole;
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  language: "nl" | "en";
  currency: string;
  createdAt: string;
  avatarColor: string; // gebruikt voor gegenereerde avatar-initials
  /** Gezet door een admin-actie (zie lib/actions/admin-actions.ts) — niet null betekent: geblokkeerd. */
  bannedAt: string | null;
  banReason: string | null;
}

/* ------------------------------------------------------------------ */
/* EVENT DATA                                                          */
/* ------------------------------------------------------------------ */

export type EventType =
  | "wedding"
  | "birthday"
  | "anniversary"
  | "christmas_party"
  | "new_year_party"
  | "corporate_party"
  | "baby_shower"
  | "bachelor_party"
  | "festival"
  | "graduation_party"
  | "dinner"
  | "garden_party"
  | "kids_party"
  | "cultural_event"
  | "business_conference"
  | "product_launch"
  | "private_party"
  | "other";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: "Bruiloft",
  birthday: "Verjaardag",
  anniversary: "Jubileum",
  christmas_party: "Kerstfeest",
  new_year_party: "Nieuwjaarsfeest",
  corporate_party: "Bedrijfsfeest",
  baby_shower: "Babyshower",
  bachelor_party: "Vrijgezellenfeest",
  festival: "Festival",
  graduation_party: "Afstudeerfeest",
  dinner: "Diner",
  garden_party: "Tuinfeest",
  kids_party: "Kinderfeest",
  cultural_event: "Religieuze / culturele festiviteit",
  business_conference: "Zakelijk congres",
  product_launch: "Productlancering",
  private_party: "Private party",
  other: "Evenement",
};

export type EventStage =
  | "draft" // net gestart, interview loopt nog
  | "planning" // plan gegenereerd, requirements worden gekozen
  | "sourcing" // aanvragen verstuurd, offertes worden verzameld
  | "booking" // shortlist/keuzes, betalingen lopen
  | "confirmed" // alles geboekt
  | "completed"
  | "cancelled"; // organisator heeft het evenement handmatig gesloten

export interface EventBudget {
  totalCents: number;
  source: Provenance;
}

export interface EventCore {
  id: string;
  ownerId: string;
  name: string;
  type: EventType;
  stage: EventStage;
  createdAt: string;
  updatedAt: string;

  date: string | null; // ISO date
  /** Als tijdens het AI-interview alleen een maand is genoemd ("ergens in juni"), zonder exacte datum. Wordt genegeerd zodra `date` bekend is. */
  monthHint: string | null;
  startTime: string | null; // HH:mm
  endTime: string | null;
  timezone: string;

  guestCountAdults: number | null;
  guestCountChildren: number | null;

  locationLabel: string | null; // bv. "Amsterdam"
  locationType: "home" | "external_venue" | "tbd" | null;
  indoorOutdoor: "indoor" | "outdoor" | "both" | null;

  budget: EventBudget | null;

  style: string | null; // bv. "modern & minimalistisch"
  theme: string | null;
  formality: "casual" | "semi_formal" | "formal" | null;
  isProfessional: boolean; // zakelijk vs privé

  description: string; // de oorspronkelijke vrije-tekst beschrijving
  notes: EventNote[];
}

export interface EventNote {
  id: string;
  eventId: string;
  text: string;
  createdAt: string;
  source: Provenance;
  /** Als AI een wijziging signaleert die impact heeft op eerdere keuzes. */
  impactSummary?: string;
}

/* ------------------------------------------------------------------ */
/* AI GENERATED DATA                                                   */
/* ------------------------------------------------------------------ */

export type RequirementPriority = "essential" | "recommended" | "optional";

export interface RequirementCategory {
  id: string;
  eventId: string;
  categoryKey: SupplierCategory;
  label: string;
  priority: RequirementPriority;
  aiRationale: string; // "Dit is een AI-aanbeveling: ..."
  selected: boolean; // gebruikerskeuze
  estimatedBudgetCents: number | null;
  /**
   * AI-conceptbericht voor deze categorie — de tekst die met leveranciers
   * gedeeld gaat worden zodra er een aanvraag verstuurd wordt. Wordt
   * gegenereerd zodra het plan klaarstaat (zie draftSupplierMessages() in
   * lib/ai/planning.ts) en is door de organisator aan te passen vóórdat
   * er echt iets verstuurd wordt.
   */
  draftMessage: string | null;
  status:
    | "suggested"
    | "selected"
    | "requested"
    | "awaiting_response"
    | "offers_received"
    | "shortlisted"
    | "confirmed"
    | "paid"
    | "completed"
    | "rejected";
}

export interface AiInterviewMessage {
  id: string;
  eventId: string;
  role: "assistant" | "user";
  text: string;
  createdAt: string;
  /** Gestructureerde velden die deze beurt heeft bijgewerkt (voor audit trail). */
  extractedFields?: Record<string, unknown>;
}

export interface EventTimelineItem {
  id: string;
  eventId: string;
  title: string;
  dueDate: string | null; // ISO date
  leadTimeLabel: string; // bv. "6 maanden vooraf"
  categoryKey: SupplierCategory | null;
  done: boolean;
  source: Provenance;
}

export interface EventTask {
  id: string;
  eventId: string;
  title: string;
  urgency: "urgent" | "soon" | "normal";
  done: boolean;
  source: Provenance;
  relatedCategory?: SupplierCategory;
}

export type RiskSection = "instellingen" | "plan" | "gasten" | "budget";

export interface RiskFlag {
  id: string;
  eventId: string;
  severity: "warning" | "info";
  message: string;
  /** Op welk tabblad dit risico op te lossen is — laat de kaart klikbaar zijn naar de juiste plek i.p.v. een dode melding. `null` bij oudere, nog niet geclassificeerde rijen. */
  section: RiskSection | null;
  createdAt: string;
}

export type RsvpStatus = "pending" | "yes" | "no" | "maybe";

export interface EventGuest {
  id: string;
  eventId: string;
  name: string;
  email: string | null;
  phone: string | null;
  groupLabel: string | null;
  plusOnes: number;
  dietaryNotes: string | null;
  rsvpStatus: RsvpStatus;
  invitedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
}

/** Wat een gast op de publieke RSVP-pagina (zonder inloggen) mag zien — bewust smaller dan `EventGuest`. */
export interface GuestPublicInfo {
  id: string;
  name: string;
  eventId: string;
  eventName: string;
  eventDate: string | null;
  eventLocation: string | null;
  rsvpStatus: RsvpStatus;
  plusOnes: number;
  dietaryNotes: string | null;
}

/* ------------------------------------------------------------------ */
/* SUPPLIER DATA                                                       */
/* ------------------------------------------------------------------ */

export type SupplierCategory =
  | "venue"
  | "catering"
  | "cake"
  | "florist"
  | "decoration"
  | "dj_music"
  | "band"
  | "photography"
  | "videography"
  | "furniture_rental"
  | "lighting_sound"
  | "cleaning"
  | "security"
  | "staffing"
  | "transport"
  | "tent_rental"
  | "entertainment"
  | "planner"
  | "photobooth"
  | "invitations"
  | "av_equipment";

export const SUPPLIER_CATEGORY_LABELS: Record<SupplierCategory, string> = {
  venue: "Locatie",
  catering: "Catering",
  cake: "Taart",
  florist: "Bloemist",
  decoration: "Decoratie",
  dj_music: "DJ",
  band: "Live muziek",
  photography: "Fotografie",
  videography: "Videografie",
  furniture_rental: "Meubelverhuur",
  lighting_sound: "Licht & geluid",
  cleaning: "Schoonmaak",
  security: "Beveiliging",
  staffing: "Bedienend personeel",
  transport: "Transport",
  tent_rental: "Tentverhuur",
  entertainment: "Entertainment",
  planner: "Eventplanner",
  photobooth: "Photobooth",
  invitations: "Uitnodigingen",
  av_equipment: "AV-apparatuur",
};

/** Eén van maximaal 3 vaste niveaus (Fiverr/Etsy-stijl) die een leverancier op zijn profiel kan zetten — zie packagesEnabled in lib/config.ts (Pro-perk). */
export type SupplierPackageTier = "basis" | "standaard" | "premium";

export interface SupplierPackage {
  tier: SupplierPackageTier;
  name: string;
  description: string;
  priceCents: number;
}

export interface SupplierProfile {
  id: string;
  companyName: string;
  contactPerson: string;
  category: SupplierCategory;
  serviceAreas: string[]; // steden/regio's
  description: string;
  minPriceCents: number;
  avgPriceCents: number;
  ratingAvg: number; // 0-5
  ratingCount: number;
  verified: boolean;
  responseRateSummary: string; // bv. "Reageert meestal binnen 12 uur"
  avgResponseHours: number;
  acceptedOfferRate: number; // 0-1
  photoGradient: [string, string]; // premium placeholder ipv echte foto
  initials: string;
  tags: string[];
  yearsActive: number;
  portfolioHighlights: string[];
  /** Alleen gezet voor échte (ingelogde) leveranciers: link naar hun openbare profielpagina. */
  isReal?: boolean;
  logoUrl?: string | null;
  /**
   * Welk abonnements-badge (spec-item #53-vervolg, SaaS-pivot) op dit moment
   * voor deze leverancier geldt — "aanbevolen" (Pro) of "elite"
   * (Premium), altijd "none" tijdens de proefperiode (ook als er
   * al een hoger niveau is gekozen: dat niveau gaat pas écht in ná de
   * proefperiode, zie computeEffectiveTier() in lib/data/store.ts) en altijd
   * "none"/undefined voor de statische demo-catalogus. Gebruikt overal waar
   * een offerte/leverancier aan een organisator wordt getoond (OfferBrowser).
   */
  tierBadge?: "none" | "aanbevolen" | "elite";
  packages: SupplierPackage[];
  /** "Profiel aankleden" (vanaf Groei/Pro/Premium, zie taglineEnabled e.a. in lib/config.ts). */
  tagline: string | null;
  coverPhotoUrl: string | null;
  /** Originele YouTube/Vimeo-link zoals ingevuld — pas bij weergave omgezet naar een embed-URL via getVideoEmbedUrl(). */
  introVideoUrl: string | null;
  /**
   * "Locatie op een kaart" (spec-item, Airbnb-geïnspireerd) — automatisch
   * bepaald uit `serviceAreas`/baseLocation via geocodeLocation() in
   * lib/geo.ts, zie ook serviceRadiusKm op SupplierAccount. Null zolang er
   * nog niet gegeocodeerd is (bv. een adres dat Nominatim niet herkent).
   */
  lat: number | null;
  lng: number | null;
}

/**
 * Een datum die een leverancier zelf heeft geblokkeerd (vakantie, elders
 * volgeboekt, etc.) — puur "afwezig", geen los `available`-veld nodig: het
 * ONTBREKEN van een rij voor een datum betekent gewoon beschikbaar. Telt
 * mee bij matching, samen met bevestigde boekingen (`offers.status ===
 * "accepted"` op diezelfde datum), zie `findRealMatchingSuppliers`.
 */
export interface SupplierBlockedDate {
  id: string;
  supplierId: string;
  date: string;
  createdAt: string;
}

/**
 * Een structureel geblokkeerde weekdag (bv. "elke maandag niet
 * beschikbaar") — los van de eenmalige `SupplierBlockedDate`s hierboven.
 * `weekday`: 0=maandag..6=zondag (matcht de Ma-Zo-volgorde in de
 * kalender-UI, NIET JS' eigen `Date.getDay()`-conventie van 0=zondag).
 */
export interface SupplierRecurringBlock {
  id: string;
  supplierId: string;
  weekday: number;
  createdAt: string;
}

/** Een leverancier die een organisator heeft opgeslagen om later makkelijk terug te vinden/opnieuw te boeken. */
export interface SupplierFavorite {
  id: string;
  userId: string;
  supplierId: string;
  /** Optionele indeling in een eigen collectie (bv. "Bruiloft 2027") — null = niet ingedeeld. Zie SupplierFavoriteCollection. */
  collectionId: string | null;
  createdAt: string;
}

/**
 * Een eigen, benoemde groepering van favorieten (spec-item #129) — bv.
 * "Bruiloft 2027" of "Backup-opties". Puur organisatorisch voor de
 * organisator zelf; heeft geen enkel effect op matching of op wat een
 * leverancier te zien krijgt.
 */
export interface SupplierFavoriteCollection {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

/** Eén browser-Web Push-abonnement (spec-item #131) — het resultaat van `PushManager.subscribe()` in de browser van de gebruiker. */
export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  authKey: string;
  createdAt: string;
}

/**
 * Een écht, inlogbaar leveranciersaccount (i.t.t. `SupplierProfile`, dat de
 * statische demo-catalogus beschrijft). Gekoppeld 1-op-1 aan een Supabase
 * Auth-gebruiker via `ownerId`.
 */
export interface SupplierAccount {
  id: string;
  ownerId: string;
  companyName: string;
  contactPerson: string;
  /** Eerste/primaire categorie — afgeleid van `categories[0]`, voor compatibiliteit. */
  category: SupplierCategory;
  /** Alle categorieën die dit bedrijf aanbiedt (meerdere mogelijk). */
  categories: SupplierCategory[];
  /** Vrije tekst als geen van de standaardcategorieën precies past. */
  categoryOther: string | null;
  serviceAreas: string[];
  /** Vestigingsplaats/postcode — middelpunt van het werkgebied. */
  baseLocation: string;
  /** Straal in kilometers rond `baseLocation` waarbinnen wordt geopereerd. */
  serviceRadiusKm: number;
  description: string;
  minPriceCents: number;
  avgPriceCents: number;
  ratingAvg: number;
  ratingCount: number;
  verified: boolean;
  /** Wanneer verificatie is aangevraagd — null als er nooit een aanvraag is gedaan (of nadat een admin 'm heeft afgehandeld). */
  verificationRequestedAt: string | null;
  avgResponseHours: number;
  acceptedOfferRate: number;
  /** Aantal offertes dat deze leverancier ooit heeft ingediend — puur bedoeld als "genoeg data?"-signaal naast acceptedOfferRate (zie recompute-acceptance-rate cron): een 0%-acceptatiegraad ZONDER ingediende offertes betekent "nog geen data", niet "altijd afgewezen". */
  offersSubmittedCount: number;
  /** Extra spotlight-activaties bovenop het gewone maandelijkse quotum (migratie 0045) — verdiend via het referral-programma of een goedgekeurde losse boost-aanvraag. Verbruikt vóórdat het gewone quotum wordt aangesproken; verloopt nooit vanzelf. */
  bonusSpotlightCredits: number;
  tags: string[];
  yearsActive: number;
  portfolioHighlights: string[];
  kvkNumber: string | null;
  website: string | null;
  socialFacebook: string | null;
  socialInstagram: string | null;
  socialTiktok: string | null;
  logoUrl: string | null;
  galleryUrls: string[];
  /**
   * Gekozen abonnementsniveau (spec-item #53, SaaS-pivot) — geldt zodra de
   * proefperiode (TRIAL_BOOKING_COUNT boekingen) voorbij is; zie
   * `resolveEffectiveSupplierTier` in lib/data/store.ts. Standaard "instap"
   * voor nieuwe leveranciers (aug. 2026); een betaald niveau kiezen loopt
   * via een echte Stripe-checkout (zie lib/payments/stripe.ts), waarna de
   * webhook dit veld bijwerkt — nooit rechtstreeks door de leverancier zelf.
   */
  subscriptionTier: SubscriptionTier;
  /** "monthly" (opzegbaar, hoger tarief) of "annual" (jaarafspraak, huidige lagere tarief) — null voor Instap/proefperiode (geen abonnement). Gezet vanuit de Stripe-webhook. */
  billingInterval: "monthly" | "annual" | null;
  /** Het bedrag (in centen, per afschrijving) waar deze leverancier ECHT voor tekende — bewust los van latere prijswijzigingen in lib/config.ts, zodat een bestaand abonnement niet stilzwijgend duurder wordt. Null voor Instap/proefperiode. */
  subscriptionPriceCents: number | null;
  /** Spiegelt Stripe's subscription-status (aug. 2026). "active" ook voor Instap (geen echt abonnement, maar niets "mis"). */
  subscriptionStatus: "active" | "past_due" | "canceled" | "incomplete";
  /** Stripe Customer-id — alleen gezet zodra deze leverancier ooit een Checkout Session heeft doorlopen. */
  stripeCustomerId: string | null;
  /** Stripe Subscription-id van het HUIDIGE abonnement — null voor Instap/proefperiode. */
  stripeSubscriptionId: string | null;
  /** "Winkel open/gesloten" — zet de leverancier zelf uit als hij tijdelijk geen nieuwe aanvragen kan aannemen (spec-item #55). Gesloten = niet zichtbaar in zoeken/matching. */
  storeOpen: boolean;
  /** Tot 3 vaste niveaus (Basis/Standaard/Premium) — alleen bewerkbaar vanaf Pro, zie packagesEnabled in lib/config.ts. */
  packages: SupplierPackage[];
  /** "Profiel aankleden" — hoe hoger het abonnement, hoe meer hiervan bewerkbaar is, zie taglineEnabled/coverPhotoEnabled/introVideoEnabled in lib/config.ts. */
  tagline: string | null;
  coverPhotoUrl: string | null;
  introVideoUrl: string | null;
  /**
   * "Locatie op een kaart" (spec-item, Airbnb-geïnspireerd) — coördinaten van
   * `baseLocation`, automatisch bijgewerkt via geocodeLocation() (lib/geo.ts)
   * zodra de leverancier zijn locatie opslaat/wijzigt. Null zolang niet (nog)
   * gelukt gegeocodeerd — de leverancier blijft dan gewoon vindbaar via de
   * lijstweergave, alleen zonder marker op de kaart.
   */
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

export type RequestTargetStatus = "pending" | "responded" | "expired";

/** Koppelt een échte leverancier aan een specifieke aanvraag. */
export interface RequestTarget {
  id: string;
  requestId: string;
  supplierId: string;
  status: RequestTargetStatus;
  createdAt: string;
}

/** Een aanvraag zoals een leverancier die in zijn inbox ziet, met eventcontext. */
export interface SupplierLead {
  target: RequestTarget;
  request: ServiceRequest;
  event: EventCore;
}

/** Een geaccepteerde offerte zoals een leverancier die als "order" ziet. */
export interface SupplierOrder {
  offer: OfferOption;
  event: EventCore | null;
  payment: Payment | null;
}

export interface SupplierEarningsSummary {
  paidCents: number;
  pendingCents: number;
  openLeadsCount: number;
  activeOrdersCount: number;
  upcomingThisMonthCount: number;
}

export interface SupplierPerformanceInsights {
  avgResponseHours: number;
  ratingAvg: number;
  ratingCount: number;
  /** null zolang er geen andere leveranciers in dezelfde categorie zijn om mee te vergelijken. */
  categoryAvgResponseHours: number | null;
  categoryAvgRating: number | null;
  categoryPeerCount: number;
  /** Eigen gemiddelde prijs (SupplierAccount.avgPriceCents) — voor Prijsadvies (Premium+, spec-item #57). */
  avgPriceCents: number;
  categoryAvgPriceCents: number | null;
  /**
   * Acceptatiegraad (0..1), dagelijks herberekend door
   * api/cron/recompute-acceptance-rate uit échte offertes. Alleen
   * betekenisvol als `offersSubmittedCount > 0` — bij 0 nooit als
   * percentage tonen (zou als "0%"/mislukking ogen i.p.v. "nog geen data").
   */
  acceptedOfferRate: number;
  offersSubmittedCount: number;
  categoryAvgAcceptedOfferRate: number | null;
}

/* ------------------------------------------------------------------ */
/* TRANSACTION / MARKETPLACE DATA                                      */
/* ------------------------------------------------------------------ */

export type RequestStatus = "sent" | "awaiting_response" | "responded" | "expired" | "cancelled";

export interface ServiceRequest {
  id: string;
  eventId: string;
  categoryKey: SupplierCategory;
  supplierIds: string[]; // 3-5 gematchte leveranciers
  desiredService: string;
  specialRequests: string;
  budgetCents: number | null;
  status: RequestStatus;
  sentAt: string;
  deadlineAt: string; // sentAt + 48u
  /** Gezet wanneer een organisator deze aanvraag rechtstreeks (maatwerk) naar één leverancier stuurde. */
  targetSupplierId: string | null;
  isDirect: boolean;
}

export type OfferStatus =
  | "pending"
  | "available"
  | "unavailable"
  | "shortlisted"
  | "accepted"
  | "declined"
  | "expired";

export interface OfferOption {
  id: string;
  requestId: string;
  eventId: string;
  supplierId: string;
  categoryKey: SupplierCategory;
  status: OfferStatus;
  totalPriceCents: number;
  pricePerPersonCents: number | null;
  includes: string[];
  excludes: string[];
  extraCostsNote: string | null;
  staffIncluded: boolean;
  deliveryIncluded: boolean;
  setupIncluded: boolean;
  teardownIncluded: boolean;
  travelCostsCents: number | null;
  cancellationPolicy: string;
  paymentTerms: string;
  validUntil: string;
  remarks: string | null;
  matchScore: number; // 0-100, AI-berekend
  matchRationale: string;
  respondedAt: string;
  swipeDecision: "none" | "shortlisted" | "rejected";
}

export type ReviewerRole = "organizer" | "supplier";

/**
 * Eén kant van een wederzijdse beoordeling na een geaccepteerde boeking
 * (spec-item "wederzijdse beoordelingen", Airbnb-geïnspireerd) — een
 * boeking heeft er twee: één met reviewerRole "organizer" (de organisator
 * beoordeelt de leverancier) en één met "supplier" (de leverancier
 * beoordeelt de organisator). Beide blijven voor de tegenpartij verborgen
 * tot allebei bestaan of het REVIEW_REVEAL_WINDOW_DAYS-venster is
 * verstreken, zie isReviewRevealed() in lib/utils.ts.
 */
export interface Review {
  id: string;
  offerId: string;
  eventId: string;
  supplierId: string;
  reviewerRole: ReviewerRole;
  rating: number; // 1-5
  comment: string | null;
  /** Alleen relevant bij reviewerRole "supplier": leverancier meldt een organisator die niet kwam opdagen. */
  noShow: boolean;
  /** Foto's van het eindresultaat (migratie 0043) — publieke URL's in de "supplier-media"-opslagruimte, net als een leveranciersgalerij. */
  photoUrls: string[];
  /** Optionele YouTube/Vimeo-link (migratie 0043) — zelfde validatie als supplier.introVideoUrl, zie getVideoEmbedUrl in lib/utils.ts. */
  videoUrl: string | null;
  createdAt: string;
}

/** Een bewaarde zoekopdracht op /leveranciers — melding bij een matchende nieuwe leverancier (zie notifyMatchingSavedSearches() in lib/data/store.ts). */
export interface SavedSearch {
  id: string;
  userId: string;
  categoryKey: SupplierCategory | null;
  location: string | null;
  query: string | null;
  createdAt: string;
}

/** Eén geactiveerde "spotlight" — zie SPOTLIGHT_MONTHLY_QUOTA in lib/config.ts en activateSpotlight() in lib/data/store.ts. */
export interface Spotlight {
  id: string;
  supplierId: string;
  categoryKey: SupplierCategory;
  startedAt: string;
  expiresAt: string;
}

export interface Shortlist {
  eventId: string;
  categoryKey: SupplierCategory;
  offerId: string;
  decision: "shortlisted" | "selected" | "rejected";
  updatedAt: string;
}

/** Bijlage bij een bericht (foto/pdf) — spec-item "bijlages in berichten", livegang-audit. `url` is een tijdelijk ondertekende link (zie getMessages() in lib/data/store.ts), géén publieke URL — de opslagruimte is bewust private. */
export interface MessageAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
}

export interface Message {
  id: string;
  eventId: string;
  categoryKey: SupplierCategory;
  supplierId: string;
  sender: "customer" | "supplier" | "ai_summary";
  text: string;
  attachments: MessageAttachment[];
  createdAt: string;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

/** "full" = in één keer, "deposit"/"balance" = aanbetaling + restbedrag als twee gekoppelde rijen. */
export type PaymentInstallment = "full" | "deposit" | "balance";

export interface Payment {
  id: string;
  eventId: string;
  offerId: string;
  categoryKey: SupplierCategory;
  supplierAmountCents: number;
  platformFeeCents: number;
  totalCents: number;
  commissionRate: number;
  /**
   * Welk abonnementsniveau (of de proefperiode) gold bij het aanmaken van
   * deze betaling — zie lib/config.ts. Historische rijen van vóór de
   * SaaS-pivot kunnen ook nog de oude waarden "intro"/"tiered"/"enterprise"
   * bevatten (Enterprise is als niveau verwijderd, maar oude betaalrijen
   * blijven ongewijzigd staan — zie migratie 0050).
   */
  commissionTier: "trial" | "instap" | "starter" | "groei" | "pro" | "premium" | "enterprise" | "intro" | "tiered";
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
  provider: "stripe" | "mock";
  installment: PaymentInstallment;
  /** Bij een "balance"-betaling: het id van de bijbehorende "deposit"-betaling. Anders null. */
  parentPaymentId: string | null;
  /**
   * Stripe-/uitbetaalvelden — voorbereiding voor een echte betaalflow
   * (spec-item #132, zie supabase/migrations/0049_stripe_payment_prep.sql).
   * Blijven `null`/`"not_applicable"` zolang `provider` nog "mock" is; pas
   * gevuld zodra de betaling écht via Stripe loopt.
   */
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  /** Het id van de Stripe Connect-transfer waarmee het bedrag (na aftrek van commissie) naar de leverancier is uitbetaald. */
  stripeTransferId: string | null;
  /** "held" = betaald door de organisator, nog vastgehouden door Vyra (escrow); "released" = doorbetaald aan de leverancier. */
  payoutStatus: "not_applicable" | "held" | "released";
  payoutReleasedAt: string | null;
}

/** Koppeling tussen een leverancier en zijn Stripe Connect-account (voor uitbetalingen) — spec-item #132. Zie migratie 0049 voor waarom dit een aparte, niet-publiek-leesbare tabel is. */
export interface SupplierStripeAccount {
  supplierId: string;
  stripeAccountId: string | null;
  /** Of Stripe deze leverancier al toestaat betalingen te ontvangen — alleen ooit gezet door de account.updated-webhook, nooit door de leverancier zelf. */
  chargesEnabled: boolean;
  /** Of Stripe deze leverancier al toestaat uitbetalingen te ontvangen (idem). */
  payoutsEnabled: boolean;
  onboardedAt: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  eventId: string | null;
  type:
    | "new_request"
    | "new_offer"
    | "supplier_responded"
    | "deadline_approaching"
    | "payment_required"
    | "payment_confirmed"
    | "event_deadline"
    | "budget_exceeded"
    | "new_ai_recommendation"
    | "new_shortlist_candidate"
    | "supplier_question"
    | "event_info_changed"
    | "verification_requested"
    | "verification_approved"
    | "verification_rejected"
    | "verification_revoked"
    | "dispute_filed"
    | "dispute_resolved"
    | "dispute_dismissed"
    | "saved_search_match"
    | "supplier_proactive_signal"
    | "tier_upgrade_approved"
    | "tier_upgrade_declined"
    | "referral_reward"
    | "spotlight_boost_approved";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  href: string | null;
}

/* ------------------------------------------------------------------ */
/* DISPUTES (spec-item #50)                                            */
/* ------------------------------------------------------------------ */

export type DisputeStatus = "open" | "resolved" | "dismissed";
export type DisputeFiledByRole = "customer" | "supplier";
export type DisputeCategory = "no_show" | "quality" | "payment" | "communication" | "other";

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  no_show: "Niet komen opdagen",
  quality: "Kwaliteit van de dienst",
  payment: "Betalingsprobleem",
  communication: "Communicatie",
  other: "Anders",
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  open: "In behandeling",
  resolved: "Opgelost",
  dismissed: "Afgewezen",
};

/**
 * Een geschil dat een organisator of leverancier meldt over een specifieke
 * betaling/boeking — spec-item #50. Alleen de admin (Cem, via service-role
 * client) kan een geschil oplossen/afwijzen; beide betrokken partijen kunnen
 * lezen en melden (zie RLS in supabase/migrations/0020_disputes.sql).
 */
export interface Dispute {
  id: string;
  paymentId: string;
  eventId: string;
  offerId: string;
  supplierId: string;
  filedBy: string;
  filedByRole: DisputeFiledByRole;
  category: DisputeCategory;
  description: string;
  status: DisputeStatus;
  adminResponse: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** Zelfbedienings-aanvraag voor een hoger abonnement (migratie 0040) — zie SubscriptionTierPicker.tsx. */
export interface SupplierTierUpgradeRequest {
  id: string;
  supplierId: string;
  requestedTier: string;
  status: "pending" | "approved" | "declined";
  adminResponse: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** Zelfbedienings-verzoek voor een losse Spotlight-boost (migratie 0045) — zie SpotlightPanel.tsx. Zelfde vorm als SupplierTierUpgradeRequest: Cem keurt handmatig goed (Vyra verwerkt nog geen betalingen zelf), goedkeuring geeft +1 bonus_spotlight_credits. */
export interface SpotlightBoostRequest {
  id: string;
  supplierId: string;
  status: "pending" | "approved" | "declined";
  adminResponse: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** Zelfbedienings-verzoek tot accountverwijdering (migratie 0044, AVG/GDPR) — zie /profile en /supplier/profile ("Privacy & gegevens"). Werkelijke verwijdering gebeurt pas na handmatige beoordeling door Cem, net als bij SupplierTierUpgradeRequest. */
export interface AccountDeletionRequest {
  id: string;
  userId: string;
  reason: string | null;
  status: "pending" | "approved" | "declined";
  adminResponse: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** "offer" = tekst voor SupplierOfferForm.tsx, "message" = tekst voor MessageComposer.tsx (leverancierskant). */
export type SupplierTemplateKind = "offer" | "message";

/** Opgeslagen sjabloon voor offertes/berichten (migratie 0042) — zie TemplatePicker.tsx. Bespaart leveranciers het steeds opnieuw uittypen van standaardteksten (bijv. een vaste catering-omschrijving of een welkomstbericht). */
export interface SupplierTemplate {
  id: string;
  supplierId: string;
  kind: SupplierTemplateKind;
  title: string;
  body: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* ADMIN AI-TEAM — dagelijks rapport (spec-item #52 vervolg)           */
/*                                                                       */
/* Cem (platformeigenaar) wil dagelijks een kort rapport zoals een      */
/* management-team dat aan een CEO zou geven: wat is er gebeurd, wat    */
/* vraagt aandacht, en — voor de dingen waar dat kan — een              */
/* goedkeuren/afwijzen-knop met één klik. Een gecoördineerde AI-aanroep */
/* (lib/ai/briefing.ts) schrijft alleen de NARRATIEVE tekst             */
/* (samenvatting + koppen per "teamlid"); WELKE items er zijn en hun    */
/* echte id's komen altijd uit de database (generateAndStoreBriefing()  */
/* in lib/data/store.ts) — nooit door de AI verzonnen. Zo kan een       */
/* kwaadwillende geschiltekst hooguit de samenvattingstekst beïnvloeden */
/* (die sowieso al door de bestaande prompt-injection-laag gaat, zie    */
/* lib/ai/client.ts), maar nooit een echte goedkeuren-knop laten        */
/* verschijnen voor iets dat niet bestaat.                              */
/* ------------------------------------------------------------------ */

export type BriefingItemKind =
  | "supplier_verification"
  | "dispute"
  | "new_supplier"
  | "new_users"
  | "flagged_ai"
  | "financial"
  /** Leverancier die de reactietermijn (SUPPLIER_RESPONSE_WINDOW_HOURS) op een aanvraag heeft laten verlopen — puur informatief, geen knop die iets uitvoert. */
  | "supplier_unresponsive"
  /** Evenement dat al ORGANIZER_STALLED_DAYS niet is bijgewerkt en nog niet is afgerond/geannuleerd — puur informatief. */
  | "organizer_stalled";
export type BriefingItemStatus = "open" | "approved" | "dismissed";

export interface AdminBriefingItem {
  id: string;
  briefingId: string;
  teamMember: string;
  kind: BriefingItemKind;
  title: string;
  description: string;
  requiresApproval: boolean;
  relatedType: string | null;
  relatedId: string | null;
  status: BriefingItemStatus;
  createdAt: string;
}

export interface AdminBriefing {
  id: string;
  coordinatorSummary: string;
  /** Eén korte kopzin per teamlid, bv. `{"Leveranciers & Verificatie": "..."}` — ook aanwezig als dat team geen punten heeft. */
  teamHeadlines: Record<string, string>;
  since: string;
  usedAI: boolean;
  createdAt: string;
  items: AdminBriefingItem[];
}

/* ------------------------------------------------------------------ */
/* Helper aggregates                                                   */
/* ------------------------------------------------------------------ */

export interface EventReadiness {
  score: number; // 0-100
  missingEssentials: SupplierCategory[];
  categoryStatus: Record<string, "confirmed" | "in_progress" | "missing">;
}

export interface EventBudgetSummary {
  totalCents: number;
  committedCents: number; // geaccepteerde offertes
  pendingCents: number; // verwachte kosten van open categorieën
  remainingCents: number;
  percentOverBudget: number; // 0 als binnen budget
}

/**
 * De belangrijkste eerstvolgende actie voor de organisator, berekend uit de
 * huidige staat van het evenement (zie `computeNextStep` in lib/data/store.ts).
 * Doel: nooit laten zoeken langs tabbladen — altijd één duidelijke stap tonen.
 */
export interface NextStep {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  icon: "sparkles" | "send" | "wallet" | "clock" | "inbox" | "check-circle";
  tone: "action" | "warning" | "success";
}

/* ------------------------------------------------------------------ */
/* GASTENFOTO-PAGINA ("Deel C", migratie 0052)                         */
/* ------------------------------------------------------------------ */

export type GalleryStatus = "pending_payment" | "active" | "expired";
export type GalleryModerationStatus = "pending" | "approved" | "rejected";

/**
 * Eén gastenfoto-pagina per evenement — pas aangemaakt zodra de organisator
 * 'm koopt (zie lib/config.ts GALLERY_TIERS). `uploadToken` is het
 * niet-raadbare deel van zowel de gast-uploadlink als de QR-code (zie
 * `/gallery/[token]`) — kennis van deze ene waarde is de enige toegangscontrole
 * voor gasten, hetzelfde patroon als de bestaande RSVP-link
 * (get_guest_public/submit_rsvp in migratie 0006).
 */
export interface EventGallery {
  id: string;
  eventId: string;
  tier: GalleryTier;
  status: GalleryStatus;
  uploadToken: string;
  /** Kleurthema-sleutel (Plus/Premium); `null` = standaard Vyra-thema. */
  theme: string | null;
  /** Gekozen uitnodigingssjabloon (Premium, zie Deel C.5); `null` = nog geen keuze gemaakt. */
  invitationTemplateKey: string | null;
  /** Override van de evenementnaam speciaal voor de uitnodiging; `null` = gebruik event.name. */
  invitationTitle: string | null;
  /** Korte intro-/welkomstzin bovenaan de uitnodiging (bv. "U bent van harte uitgenodigd"). */
  invitationWelcomeText: string | null;
  invitationPhotoPath: string | null;
  invitationPhotoUrl: string | null;
  /** Berekend bij activatie: evenementdatum + retentionDays van het gekozen niveau. `null` zolang nog niet actief. */
  expiresAt: string | null;
  createdAt: string;
  purchasedAt: string | null;
}

export interface GalleryPhoto {
  id: string;
  galleryId: string;
  guestName: string | null;
  storagePath: string;
  publicUrl: string;
  isVideo: boolean;
  moderationStatus: GalleryModerationStatus;
  createdAt: string;
}

export interface GalleryMessage {
  id: string;
  galleryId: string;
  guestName: string | null;
  message: string;
  moderationStatus: GalleryModerationStatus;
  createdAt: string;
}

/** Wat de publieke, ongeauthenticeerde gastenpagina (`/gallery/[token]`) nodig heeft — nooit meer dan dit blootstellen. */
export interface GalleryPublicInfo {
  eventName: string;
  eventDate: string | null;
  eventStartTime: string | null;
  eventLocationLabel: string | null;
  organizerFirstName: string | null;
  tier: GalleryTier;
  theme: string | null;
  status: GalleryStatus;
  expiresAt: string | null;
  allowVideo: boolean;
  allowGuestbook: boolean;
  maxUploadMb: number;
  invitationTemplateKey: string | null;
  invitationTitle: string | null;
  invitationWelcomeText: string | null;
  invitationPhotoUrl: string | null;
}

export type FeedbackType = "question" | "bug";
export type FeedbackStatus = "open" | "resolved";

/** Een melding via de "hulp"-FAB die op elke pagina staat (zowel ingelogd als anoniem). */
export interface FeedbackReport {
  id: string;
  type: FeedbackType;
  message: string;
  pagePath: string | null;
  userId: string | null;
  email: string | null;
  role: string | null;
  status: FeedbackStatus;
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}
