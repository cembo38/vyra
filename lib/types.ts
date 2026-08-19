/**
 * Centraal datamodel voor het platform.
 *
 * Ontwerpregel (zie productspec §57): we maken expliciet onderscheid tussen
 * USER DATA, EVENT DATA, AI GENERATED DATA, SUPPLIER DATA en TRANSACTION DATA.
 * AI-gegenereerde informatie wordt nooit opgeslagen alsof deze door de
 * gebruiker of leverancier is bevestigd — vandaar het `Provenance`-type dat
 * overal wordt meegegeven waar dat onderscheid ertoe doet.
 */

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

export interface RiskFlag {
  id: string;
  eventId: string;
  severity: "warning" | "info";
  message: string;
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
}

export interface SupplierAvailabilitySlot {
  supplierId: string;
  date: string;
  available: boolean;
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

export interface Shortlist {
  eventId: string;
  categoryKey: SupplierCategory;
  offerId: string;
  decision: "shortlisted" | "selected" | "rejected";
  updatedAt: string;
}

export interface Message {
  id: string;
  eventId: string;
  categoryKey: SupplierCategory;
  supplierId: string;
  sender: "customer" | "supplier" | "ai_summary";
  text: string;
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
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
  provider: "stripe" | "mock";
  installment: PaymentInstallment;
  /** Bij een "balance"-betaling: het id van de bijbehorende "deposit"-betaling. Anders null. */
  parentPaymentId: string | null;
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
    | "verification_approved"
    | "verification_rejected";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  href: string | null;
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
