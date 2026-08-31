import "server-only";
import { uid } from "@/lib/utils";
import {
  ADMIN_EMAILS,
  DEFAULT_DEPOSIT_PERCENT,
  EffectiveSupplierTier,
  EMAIL_ENABLED,
  ORGANIZER_STALLED_DAYS,
  SPOTLIGHT_DURATION_DAYS,
  SUPPLIER_RESPONSE_WINDOW_HOURS,
  SubscriptionTier,
  TRIAL_BOOKING_COUNT,
  calculateCommission,
  formatCurrency,
  getEffectiveTierDefinition,
} from "@/lib/config";
import { SUPPLIERS, suppliersByCategory, getSupplierById } from "@/lib/data/suppliers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendNotificationEmail } from "@/lib/email/send";
import { BRIEFING_TEAM_MEMBERS, generateBriefingNarrative, type BriefingTeamKey } from "@/lib/ai/briefing";
import { narrateSupplierBriefing } from "@/lib/ai/supplierAssistant";
import {
  AdminBriefing,
  AdminBriefingItem,
  AiInterviewMessage,
  AppNotification,
  BriefingItemStatus,
  Dispute,
  DISPUTE_CATEGORY_LABELS,
  DisputeCategory,
  DisputeFiledByRole,
  DisputeStatus,
  EventBudgetSummary,
  EventCore,
  EventGuest,
  EventNote,
  EventReadiness,
  EventStage,
  EventTask,
  EventTimelineItem,
  GuestPublicInfo,
  Message,
  MessageAttachment,
  NextStep,
  OfferOption,
  Payment,
  RequestTarget,
  RequirementCategory,
  RequirementPriority,
  Review,
  ReviewerRole,
  RiskFlag,
  RsvpStatus,
  SavedSearch,
  ServiceRequest,
  Spotlight,
  SUPPLIER_CATEGORY_LABELS,
  SupplierAccount,
  SupplierBlockedDate,
  SupplierCategory,
  SupplierEarningsSummary,
  PushSubscriptionRecord,
  SupplierFavorite,
  SupplierFavoriteCollection,
  SupplierLead,
  SupplierRecurringBlock,
  SupplierOrder,
  SupplierPackage,
  AccountDeletionRequest,
  SpotlightBoostRequest,
  SupplierPerformanceInsights,
  SupplierProfile,
  SupplierTemplate,
  SupplierTemplateKind,
  SupplierTierUpgradeRequest,
  SupplierStripeAccount,
  UserAccount,
} from "@/lib/types";

// Herexport — SupplierEarningsSummary/SupplierPerformanceInsights woonden
// voorheen hier als losse `export interface`, maar zijn verhuisd naar
// lib/types.ts (samen met de andere Supplier*-types) zodat lib/ai/
// supplierAssistantMock.ts (bewust GEEN "server-only", zie dat bestand) ze
// kan importeren zonder store.ts's "server-only"-keten mee te slepen.
// Bestaande `import { SupplierEarningsSummary } from "@/lib/data/store"`-
// aanroepen elders in de app blijven zo werken zonder wijziging.
export type { SupplierEarningsSummary, SupplierPerformanceInsights };

/**
 * Data-laag, nu écht persistent via Supabase (Postgres) i.p.v. een
 * in-memory store. Zie supabase/migrations/0001_init.sql voor het schema.
 *
 * Elke functie behoudt dezelfde naam/signature als voorheen (nu async),
 * zodat de rest van de app (components, routes, AI-laag) niet hoeft te
 * weten dat de opslag is veranderd — dit was precies het migratiepad dat
 * in docs/DATABASE_SCHEMA.md beschreven stond.
 *
 * Row Level Security in Postgres zorgt dat een gebruiker alleen zijn eigen
 * events (en alles wat daaraan hangt) kan lezen/schrijven — er is dus geen
 * aparte "userId === ownerId"-check nodig in deze functies zelf.
 */

export async function sb() {
  const client = await createSupabaseServerClient();
  if (!client) {
    throw new Error(
      "Supabase is niet geconfigureerd. Zet NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (zie .env.example)."
    );
  }
  return client;
}

/**
 * Echte, platformbrede cijfers voor de homepage-hero (components/marketing/
 * Hero.tsx) — verving twee vaste, verzonnen getallen ("2000+ evenementen",
 * "4.8/5") die nergens uit data kwamen. Haalt het geaggregeerde resultaat
 * op via de `platform_stats()`-databasefunctie (migratie 0038, SECURITY
 * DEFINER naar het patroon van `reviews_revealed()`) zodat ook een
 * uitgelogde bezoeker dit mag lezen zonder de RLS op `events`/`reviews`
 * te hoeven versoepelen.
 *
 * Bewust defensief: dit draait op de publieke homepage, dus een
 * ontbrekende Supabase-configuratie of een tijdelijke netwerkfout mag de
 * hele pagina nooit laten crashen — bij elke fout komt gewoon de
 * nul-stand terug, en Hero.tsx toont dan een niet-cijfermatige
 * vertrouwenszin in plaats van een leeg of kapot cijfer.
 */
export async function getPlatformStats(): Promise<{ eventCount: number; avgRating: number | null; ratingCount: number }> {
  try {
    const supabase = await sb();
    const { data, error } = await supabase.rpc("platform_stats").maybeSingle();
    if (error || !data) return { eventCount: 0, avgRating: null, ratingCount: 0 };
    const r = data as Row;
    return {
      eventCount: Number(r.event_count ?? 0),
      avgRating: r.avg_rating == null ? null : Number(r.avg_rating),
      ratingCount: Number(r.rating_count ?? 0),
    };
  } catch {
    return { eventCount: 0, avgRating: null, ratingCount: 0 };
  }
}

/* ------------------------------------------------------------------ */
/* MAPPING: snake_case (Postgres) <-> camelCase (app)                  */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function rowToUser(r: Row): UserAccount {
  return {
    id: r.id,
    role: r.role,
    email: r.email,
    firstName: r.first_name ?? "",
    lastName: r.last_name ?? "",
    country: r.country ?? "NL",
    language: r.language ?? "nl",
    currency: r.currency ?? "EUR",
    createdAt: r.created_at,
    avatarColor: r.avatar_color ?? "#6B7A5E",
    bannedAt: r.banned_at ?? null,
    banReason: r.ban_reason ?? null,
  };
}

function rowToEvent(r: Row, notes: EventNote[] = []): EventCore {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    type: r.type,
    stage: r.stage,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    date: r.date,
    monthHint: r.month_hint ?? null,
    startTime: r.start_time,
    endTime: r.end_time,
    timezone: r.timezone,
    guestCountAdults: r.guest_count_adults,
    guestCountChildren: r.guest_count_children,
    locationLabel: r.location_label,
    locationType: r.location_type,
    indoorOutdoor: r.indoor_outdoor,
    budget: r.budget ?? null,
    style: r.style,
    theme: r.theme,
    formality: r.formality,
    isProfessional: r.is_professional,
    description: r.description,
    notes,
  };
}

function rowToNote(r: Row): EventNote {
  return { id: r.id, eventId: r.event_id, text: r.text, createdAt: r.created_at, source: r.source, impactSummary: r.impact_summary ?? undefined };
}

function rowToInterviewMessage(r: Row): AiInterviewMessage {
  return { id: r.id, eventId: r.event_id, role: r.role, text: r.text, createdAt: r.created_at, extractedFields: r.extracted_fields ?? undefined };
}

function rowToRequirement(r: Row): RequirementCategory {
  return {
    id: r.id,
    eventId: r.event_id,
    categoryKey: r.category_key,
    label: r.label,
    priority: r.priority,
    aiRationale: r.ai_rationale ?? "",
    selected: r.selected,
    estimatedBudgetCents: r.estimated_budget_cents,
    draftMessage: r.draft_message ?? null,
    status: r.status,
  };
}

function rowToRequest(r: Row): ServiceRequest {
  return {
    id: r.id,
    eventId: r.event_id,
    categoryKey: r.category_key,
    supplierIds: r.supplier_ids ?? [],
    desiredService: r.desired_service ?? "",
    specialRequests: r.special_requests ?? "",
    budgetCents: r.budget_cents,
    status: r.status,
    sentAt: r.sent_at,
    deadlineAt: r.deadline_at,
    targetSupplierId: r.target_supplier_id ?? null,
    isDirect: r.is_direct ?? false,
  };
}

function rowToOffer(r: Row): OfferOption {
  return {
    id: r.id,
    requestId: r.request_id,
    eventId: r.event_id,
    supplierId: r.supplier_id,
    categoryKey: r.category_key,
    status: r.status,
    totalPriceCents: r.total_price_cents,
    pricePerPersonCents: r.price_per_person_cents,
    includes: r.includes ?? [],
    excludes: r.excludes ?? [],
    extraCostsNote: r.extra_costs_note,
    staffIncluded: r.staff_included,
    deliveryIncluded: r.delivery_included,
    setupIncluded: r.setup_included,
    teardownIncluded: r.teardown_included,
    travelCostsCents: r.travel_costs_cents,
    cancellationPolicy: r.cancellation_policy ?? "",
    paymentTerms: r.payment_terms ?? "",
    validUntil: r.valid_until,
    remarks: r.remarks,
    matchScore: r.match_score,
    matchRationale: r.match_rationale ?? "",
    respondedAt: r.responded_at,
    swipeDecision: r.swipe_decision,
  };
}

function rowToTimeline(r: Row): EventTimelineItem {
  return { id: r.id, eventId: r.event_id, title: r.title, dueDate: r.due_date, leadTimeLabel: r.lead_time_label ?? "", categoryKey: r.category_key, done: r.done, source: r.source };
}

function rowToTask(r: Row): EventTask {
  return { id: r.id, eventId: r.event_id, title: r.title, urgency: r.urgency, done: r.done, source: r.source, relatedCategory: r.related_category ?? undefined };
}

function rowToRisk(r: Row): RiskFlag {
  return { id: r.id, eventId: r.event_id, severity: r.severity, message: r.message, createdAt: r.created_at };
}

function rowToPayment(r: Row): Payment {
  return {
    id: r.id,
    eventId: r.event_id,
    offerId: r.offer_id,
    categoryKey: r.category_key,
    supplierAmountCents: r.supplier_amount_cents,
    platformFeeCents: r.platform_fee_cents,
    totalCents: r.total_cents,
    commissionRate: Number(r.commission_rate),
    commissionTier: r.commission_tier ?? "tiered",
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    provider: r.provider,
    installment: r.installment ?? "full",
    parentPaymentId: r.parent_payment_id ?? null,
    stripePaymentIntentId: r.stripe_payment_intent_id ?? null,
    stripeCheckoutSessionId: r.stripe_checkout_session_id ?? null,
    stripeTransferId: r.stripe_transfer_id ?? null,
    payoutStatus: r.payout_status ?? "not_applicable",
    payoutReleasedAt: r.payout_released_at ?? null,
  };
}

function rowToMessage(r: Row): Message {
  // `attachments` wordt hier bewust leeg gelaten — die komen uit een aparte
  // `message_attachments`-tabel en (voor de URL) een ondertekende-URL-
  // aanroep, allebei per-batch afgehandeld in getMessages() hieronder i.p.v.
  // hier per rij, om niet N+1 aparte aanroepen naar Supabase Storage te doen.
  return { id: r.id, eventId: r.event_id, categoryKey: r.category_key, supplierId: r.supplier_id, sender: r.sender, text: r.text, attachments: [], createdAt: r.created_at };
}

function rowToMessageAttachment(r: Row): Omit<MessageAttachment, "url"> & { storagePath: string; messageId: string } {
  return { id: r.id, messageId: r.message_id, storagePath: r.storage_path, fileName: r.file_name, mimeType: r.mime_type, sizeBytes: r.size_bytes ?? 0 };
}

function rowToNotification(r: Row): AppNotification {
  return { id: r.id, userId: r.user_id, eventId: r.event_id, type: r.type, title: r.title, body: r.body ?? "", read: r.read, createdAt: r.created_at, href: r.href };
}

function rowToSupplierAccount(r: Row): SupplierAccount {
  const categories: SupplierCategory[] = r.categories && r.categories.length > 0 ? r.categories : r.category ? [r.category] : [];
  return {
    id: r.id,
    ownerId: r.owner_id,
    companyName: r.company_name,
    contactPerson: r.contact_person ?? "",
    category: categories[0] ?? r.category,
    categories,
    categoryOther: r.category_other ?? null,
    serviceAreas: r.service_areas ?? [],
    baseLocation: r.base_location ?? (r.service_areas?.[0] ?? ""),
    serviceRadiusKm: r.service_radius_km ?? 25,
    description: r.description ?? "",
    minPriceCents: r.min_price_cents ?? 0,
    avgPriceCents: r.avg_price_cents ?? 0,
    ratingAvg: Number(r.rating_avg ?? 0),
    ratingCount: r.rating_count ?? 0,
    verified: r.verified ?? false,
    verificationRequestedAt: r.verification_requested_at ?? null,
    avgResponseHours: r.avg_response_hours ?? 24,
    acceptedOfferRate: Number(r.accepted_offer_rate ?? 0),
    offersSubmittedCount: r.offers_submitted_count ?? 0,
    bonusSpotlightCredits: r.bonus_spotlight_credits ?? 0,
    tags: r.tags ?? [],
    yearsActive: r.years_active ?? 0,
    portfolioHighlights: r.portfolio_highlights ?? [],
    kvkNumber: r.kvk_number ?? null,
    website: r.website ?? null,
    socialFacebook: r.social_facebook ?? null,
    socialInstagram: r.social_instagram ?? null,
    socialTiktok: r.social_tiktok ?? null,
    logoUrl: r.logo_url ?? null,
    galleryUrls: r.gallery_urls ?? [],
    subscriptionTier: (r.subscription_tier ?? "instap") as SubscriptionTier,
    billingInterval: (r.billing_interval ?? null) as "monthly" | "annual" | null,
    subscriptionPriceCents: r.subscription_price_cents ?? null,
    subscriptionStatus: (r.subscription_status ?? "active") as SupplierAccount["subscriptionStatus"],
    stripeCustomerId: r.stripe_customer_id ?? null,
    stripeSubscriptionId: r.stripe_subscription_id ?? null,
    storeOpen: r.store_open ?? true,
    packages: (r.packages ?? []) as SupplierPackage[],
    tagline: r.tagline ?? null,
    coverPhotoUrl: r.cover_photo_url ?? null,
    introVideoUrl: r.intro_video_url ?? null,
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    createdAt: r.created_at,
  };
}

function rowToRequestTarget(r: Row): RequestTarget {
  return { id: r.id, requestId: r.request_id, supplierId: r.supplier_id, status: r.status, createdAt: r.created_at };
}

function rowToSupplierBlockedDate(r: Row): SupplierBlockedDate {
  return { id: r.id, supplierId: r.supplier_id, date: r.date, createdAt: r.created_at };
}

function rowToSupplierRecurringBlock(r: Row): SupplierRecurringBlock {
  return { id: r.id, supplierId: r.supplier_id, weekday: r.weekday, createdAt: r.created_at };
}

function rowToSupplierFavorite(r: Row): SupplierFavorite {
  return { id: r.id, userId: r.user_id, supplierId: r.supplier_id, collectionId: r.collection_id ?? null, createdAt: r.created_at };
}

function rowToSupplierFavoriteCollection(r: Row): SupplierFavoriteCollection {
  return { id: r.id, userId: r.user_id, name: r.name, createdAt: r.created_at };
}

function rowToDispute(r: Row): Dispute {
  return {
    id: r.id,
    paymentId: r.payment_id,
    eventId: r.event_id,
    offerId: r.offer_id,
    supplierId: r.supplier_id,
    filedBy: r.filed_by,
    filedByRole: r.filed_by_role,
    category: r.category,
    description: r.description,
    status: r.status,
    adminResponse: r.admin_response ?? null,
    resolvedAt: r.resolved_at ?? null,
    createdAt: r.created_at,
  };
}

function rowToTierUpgradeRequest(r: Row): SupplierTierUpgradeRequest {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    requestedTier: r.requested_tier,
    status: r.status,
    adminResponse: r.admin_response ?? null,
    resolvedAt: r.resolved_at ?? null,
    createdAt: r.created_at,
  };
}

function rowToAccountDeletionRequest(r: Row): AccountDeletionRequest {
  return {
    id: r.id,
    userId: r.user_id,
    reason: r.reason ?? null,
    status: r.status,
    adminResponse: r.admin_response ?? null,
    resolvedAt: r.resolved_at ?? null,
    createdAt: r.created_at,
  };
}

function rowToSupplierTemplate(r: Row): SupplierTemplate {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
  };
}

function rowToGuest(r: Row): EventGuest {
  return {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    email: r.email ?? null,
    phone: r.phone ?? null,
    groupLabel: r.group_label ?? null,
    plusOnes: r.plus_ones ?? 0,
    dietaryNotes: r.dietary_notes ?? null,
    rsvpStatus: r.rsvp_status ?? "pending",
    invitedAt: r.invited_at ?? null,
    respondedAt: r.responded_at ?? null,
    createdAt: r.created_at,
  };
}

/* ------------------------------------------------------------------ */
/* USERS                                                               */
/* ------------------------------------------------------------------ */

export async function getUser(userId: string): Promise<UserAccount | null> {
  const supabase = await sb();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data ? rowToUser(data) : null;
}

export async function updateUser(userId: string, patch: Partial<UserAccount>): Promise<UserAccount | null> {
  const supabase = await sb();
  const update: Row = {};
  if (patch.firstName !== undefined) update.first_name = patch.firstName;
  if (patch.lastName !== undefined) update.last_name = patch.lastName;
  if (patch.country !== undefined) update.country = patch.country;
  if (patch.language !== undefined) update.language = patch.language;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.avatarColor !== undefined) update.avatar_color = patch.avatarColor;
  // `role` bewust ook hier toegestaan (niet alleen bij aanmaken) — spec-item
  // "rolkeuze aanpassen": iemand die eerst alleen organisator was, kan later
  // via /profile alsnog "ook leverancier" aanvinken, en andersom. De
  // aanroepende action (`updateRoleAction` in lib/actions/auth-actions.ts)
  // whitelist't de waarde al tegen 'customer'/'supplier'/'both' — nooit
  // 'admin', dat loopt uitsluitend via ADMIN_EMAILS.
  if (patch.role !== undefined) update.role = patch.role;
  const { data, error } = await supabase.from("profiles").update(update).eq("id", userId).select().single();
  if (error || !data) return null;
  return rowToUser(data);
}

/* ------------------------------------------------------------------ */
/* EVENTS                                                               */
/* ------------------------------------------------------------------ */

export async function listEventsForUser(userId: string): Promise<EventCore[]> {
  const supabase = await sb();
  const { data } = await supabase.from("events").select("*").eq("owner_id", userId).order("updated_at", { ascending: false });
  return (data ?? []).map((r) => rowToEvent(r));
}

export async function getEvent(eventId: string): Promise<EventCore | null> {
  const supabase = await sb();
  const { data: eventRow } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!eventRow) return null;
  const { data: noteRows } = await supabase.from("event_notes").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  return rowToEvent(eventRow, (noteRows ?? []).map(rowToNote));
}

export async function createEvent(ownerId: string, description: string): Promise<EventCore> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("events")
    .insert({ owner_id: ownerId, name: "Nieuw evenement", type: "other", stage: "draft", description })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Kon evenement niet aanmaken");
  return rowToEvent(data);
}

export async function updateEvent(eventId: string, patch: Partial<EventCore>): Promise<EventCore | null> {
  const supabase = await sb();
  const update: Row = { updated_at: new Date().toISOString() };
  const map: Record<string, string> = {
    name: "name", type: "type", stage: "stage", description: "description", date: "date", monthHint: "month_hint",
    startTime: "start_time", endTime: "end_time", timezone: "timezone",
    guestCountAdults: "guest_count_adults", guestCountChildren: "guest_count_children",
    locationLabel: "location_label", locationType: "location_type", indoorOutdoor: "indoor_outdoor",
    budget: "budget", style: "style", theme: "theme", formality: "formality", isProfessional: "is_professional",
  };
  for (const [key, column] of Object.entries(map)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((patch as any)[key] !== undefined) update[column] = (patch as any)[key];
  }
  const { data, error } = await supabase.from("events").update(update).eq("id", eventId).select().single();
  if (error || !data) return null;
  return getEvent(eventId);
}

/**
 * Verwijdert een evenement definitief. Alle gekoppelde data (notities,
 * AI-interviewberichten, requirements, aanvragen, offertes, berichten,
 * betalingen, gasten, taken/risico's/tijdlijn) gaat mee weg via
 * `on delete cascade` in het databaseschema — dit is dus onomkeerbaar.
 */
export async function deleteEvent(eventId: string): Promise<boolean> {
  const supabase = await sb();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  return !error;
}

export async function addEventNote(eventId: string, text: string, source: EventNote["source"], impactSummary?: string): Promise<EventNote | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("event_notes")
    .insert({ event_id: eventId, text, source, impact_summary: impactSummary ?? null })
    .select()
    .single();
  await supabase.from("events").update({ updated_at: new Date().toISOString() }).eq("id", eventId);
  if (error || !data) return null;
  return rowToNote(data);
}

/* ------------------------------------------------------------------ */
/* AI INTERVIEW                                                        */
/* ------------------------------------------------------------------ */

export async function getInterviewMessages(eventId: string): Promise<AiInterviewMessage[]> {
  const supabase = await sb();
  const { data } = await supabase.from("ai_interview_messages").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
  return (data ?? []).map(rowToInterviewMessage);
}

export async function addInterviewMessage(msg: Omit<AiInterviewMessage, "id" | "createdAt">): Promise<AiInterviewMessage> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("ai_interview_messages")
    .insert({ event_id: msg.eventId, role: msg.role, text: msg.text, extracted_fields: msg.extractedFields ?? null })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Kon bericht niet opslaan");
  return rowToInterviewMessage(data);
}

/* ------------------------------------------------------------------ */
/* REQUIREMENTS / PLAN                                                 */
/* ------------------------------------------------------------------ */

export async function getRequirements(eventId: string): Promise<RequirementCategory[]> {
  const supabase = await sb();
  const { data } = await supabase.from("event_requirements").select("*").eq("event_id", eventId);
  return (data ?? []).map(rowToRequirement);
}

export async function setRequirements(eventId: string, categories: RequirementCategory[]): Promise<RequirementCategory[]> {
  const supabase = await sb();
  await supabase.from("event_requirements").delete().eq("event_id", eventId);
  if (categories.length === 0) return [];
  const rows = categories.map((c) => ({
    event_id: eventId,
    category_key: c.categoryKey,
    label: c.label,
    priority: c.priority,
    ai_rationale: c.aiRationale,
    selected: c.selected,
    estimated_budget_cents: c.estimatedBudgetCents,
    draft_message: c.draftMessage,
    status: c.status,
  }));
  const { data, error } = await supabase.from("event_requirements").insert(rows).select();
  if (error || !data) return [];
  return data.map(rowToRequirement);
}

export async function toggleRequirementSelection(eventId: string, categoryId: string, selected: boolean): Promise<RequirementCategory[]> {
  const supabase = await sb();
  const patch: Row = { selected };
  if (selected) patch.status = "selected";
  await supabase.from("event_requirements").update(patch).eq("id", categoryId).eq("event_id", eventId);
  return getRequirements(eventId);
}

/**
 * Laat de organisator het AI-conceptbericht voor een categorie aanpassen
 * vóórdat er een aanvraag naar leveranciers verstuurd wordt (zie
 * RequirementDraftEditor.tsx op /events/[id]/plan).
 */
export async function updateRequirementDraftMessage(eventId: string, categoryId: string, draftMessage: string): Promise<void> {
  const supabase = await sb();
  await supabase.from("event_requirements").update({ draft_message: draftMessage }).eq("id", categoryId).eq("event_id", eventId);
}

/**
 * Slaat een handmatig aangepaste budgetverdeling op (spec-item: schuiven
 * boven op de planpagina, gemeld aug. 2026, zie BudgetAllocator.tsx) — één
 * ronde voor alle gewijzigde categorieën tegelijk i.p.v. losse aanroepen per
 * schuif, want tijdens het slepen kunnen meerdere categorieën tegelijk
 * verschuiven (de andere schuiven vangen het verschil proportioneel op).
 */
export async function updateRequirementBudgets(eventId: string, updates: { categoryId: string; estimatedBudgetCents: number }[]): Promise<RequirementCategory[]> {
  const supabase = await sb();
  await Promise.all(
    updates.map((u) => supabase.from("event_requirements").update({ estimated_budget_cents: u.estimatedBudgetCents }).eq("id", u.categoryId).eq("event_id", eventId))
  );
  return getRequirements(eventId);
}

export async function updateRequirementStatus(eventId: string, categoryKey: SupplierCategory, status: RequirementCategory["status"]): Promise<RequirementCategory[]> {
  const supabase = await sb();
  await supabase.from("event_requirements").update({ status }).eq("event_id", eventId).eq("category_key", categoryKey);
  return getRequirements(eventId);
}

/* ------------------------------------------------------------------ */
/* SUPPLIERS / MATCHING (statische catalogus, geen DB nodig)           */
/* ------------------------------------------------------------------ */

export function findMatchingSuppliers(categoryKey: SupplierCategory, opts: { locationLabel?: string | null; limit?: number }) {
  const pool = suppliersByCategory(categoryKey);
  const scored = pool.map((sup) => {
    let score = 60;
    if (opts.locationLabel && sup.serviceAreas.some((a) => a.toLowerCase().includes(opts.locationLabel!.toLowerCase()))) {
      score += 20;
    }
    score += Math.round(sup.ratingAvg * 4);
    score += Math.round(sup.acceptedOfferRate * 10);
    if (sup.verified) score += 5;
    score = Math.min(99, score);
    return { supplier: sup, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.limit ?? 5);
}

/* ------------------------------------------------------------------ */
/* ECHTE LEVERANCIERSACCOUNTS                                          */
/* ------------------------------------------------------------------ */

export async function getSupplierAccountByOwner(ownerId: string): Promise<SupplierAccount | null> {
  const supabase = await sb();
  const { data } = await supabase.from("suppliers").select("*").eq("owner_id", ownerId).maybeSingle();
  return data ? rowToSupplierAccount(data) : null;
}

export async function getSupplierAccount(supplierId: string): Promise<SupplierAccount | null> {
  const supabase = await sb();
  const { data } = await supabase.from("suppliers").select("*").eq("id", supplierId).maybeSingle();
  return data ? rowToSupplierAccount(data) : null;
}

/**
 * Openbare leverancierszoekfunctie (voor `/leveranciers`). Zoekt alleen in
 * échte (ingelogde) accounts — de statische demo-catalogus is puur voor de
 * AI-matching-simulatie en heeft geen eigen profielpagina's.
 */
export async function searchSupplierAccounts(filters: {
  /** Meerdere categorieën = OF-matching (Cem, aug. 2026: "meerdere categorieën aanvinken") — een leverancier komt mee zodra hij minstens één ervan aanbiedt. */
  categories?: SupplierCategory[];
  location?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  query?: string;
  /** "Alleen geverifieerd" (livegang-audit, vergelijkbaar met Etsy's "Star Seller"-filter). */
  verifiedOnly?: boolean;
  /** Minimale beoordeling (1-5) — sluit bewust ook nog-onbeoordeelde leveranciers (rating_avg 0) uit, net als bij Etsy: een ondergrens filtert per definitie leveranciers weg waarvan je nog niet weet of ze eraan voldoen. */
  minRating?: number;
}): Promise<SupplierAccount[]> {
  const supabase = await sb();
  // Een leverancier die zichzelf op "gesloten" heeft gezet (spec-item #55)
  // mag niet gevonden worden — dat is precies het doel van die schakelaar.
  let dbQuery = supabase.from("suppliers").select("*").eq("store_open", true);
  // .overlaps (Postgres &&) i.p.v. .contains (@>): "heeft minstens één van
  // deze categorieën", niet "heeft ALLE meegegeven categorieën".
  if (filters.categories && filters.categories.length > 0) dbQuery = dbQuery.overlaps("categories", filters.categories);
  if (filters.location) dbQuery = dbQuery.ilike("base_location", `%${filters.location}%`);
  if (filters.minPriceCents != null) dbQuery = dbQuery.gte("avg_price_cents", filters.minPriceCents);
  if (filters.maxPriceCents != null) dbQuery = dbQuery.lte("avg_price_cents", filters.maxPriceCents);
  if (filters.verifiedOnly) dbQuery = dbQuery.eq("verified", true);
  if (filters.minRating != null) dbQuery = dbQuery.gte("rating_avg", filters.minRating);
  const { data } = await dbQuery.order("rating_avg", { ascending: false }).limit(60);
  let results = (data ?? []).map(rowToSupplierAccount);

  if (filters.query) {
    const q = filters.query.toLowerCase();
    results = results.filter((s) =>
      s.companyName.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.categoryOther ?? "").toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  return results;
}

function rowToSpotlight(r: Row): Spotlight {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    categoryKey: r.category_key,
    startedAt: r.started_at,
    expiresAt: r.expires_at,
  };
}

/** Alle op dit moment actieve spotlights van deze leverancier (voor het eigen profiel — zie SpotlightPanel). */
export async function getActiveSpotlightsForSupplier(supplierId: string): Promise<Spotlight[]> {
  const supabase = await sb();
  const { data } = await supabase
    .from("spotlights")
    .select("*")
    .eq("supplier_id", supplierId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true });
  return (data ?? []).map(rowToSpotlight);
}

/**
 * Voor de openbare /leveranciers-zoekpagina: welke van deze leveranciers
 * hebben op dit moment een actieve spotlight? Als `categoryKeys` is
 * meegegeven (de organisator filtert op één of meer categorieën) telt
 * alleen een spotlight voor één van díe categorieën mee — anders telt elke
 * actieve spotlight van die leverancier mee.
 */
export async function getActiveSpotlightSupplierIds(supplierIds: string[], categoryKeys?: SupplierCategory[]): Promise<Set<string>> {
  if (supplierIds.length === 0) return new Set();
  const supabase = await sb();
  let query = supabase.from("spotlights").select("supplier_id").in("supplier_id", supplierIds).gt("expires_at", new Date().toISOString());
  if (categoryKeys && categoryKeys.length > 0) query = query.in("category_key", categoryKeys);
  const { data } = await query;
  return new Set((data ?? []).map((r: Row) => r.supplier_id as string));
}

/** Hoeveel spotlights deze leverancier deze kalendermaand al heeft geactiveerd — tegen SPOTLIGHT_MONTHLY_QUOTA in lib/config.ts. */
export async function countSpotlightActivationsThisMonth(supplierId: string): Promise<number> {
  const supabase = await sb();
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count } = await supabase
    .from("spotlights")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .gte("started_at", startOfMonth);
  return count ?? 0;
}

/**
 * Activeert een spotlight — puur de schrijfactie, zonder validatie (quota,
 * of de leverancier deze categorie überhaupt aanbiedt, of er al een actieve
 * spotlight op deze categorie staat). Die checks horen bij de aanroeper
 * (activateSpotlightAction in lib/actions/supplier-actions.ts) omdat ze om
 * duidelijke foutmeldingen aan de leverancier vragen.
 */
export async function activateSpotlight(supplierId: string, categoryKey: SupplierCategory): Promise<Spotlight | null> {
  const supabase = await sb();
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + SPOTLIGHT_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("spotlights")
    .insert({ supplier_id: supplierId, category_key: categoryKey, started_at: startedAt.toISOString(), expires_at: expiresAt.toISOString() })
    .select()
    .single();
  if (error || !data) return null;
  return rowToSpotlight(data);
}

function rowToSpotlightBoostRequest(r: Row): SpotlightBoostRequest {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    status: r.status,
    adminResponse: r.admin_response ?? null,
    resolvedAt: r.resolved_at ?? null,
    createdAt: r.created_at,
  };
}

/**
 * "Referral-programma" (livegang-audit) — beloont de UITNODIGER op het
 * moment dat de uitgenodigde zich aanmeldt (`profiles.referred_by`, gezet
 * door handle_new_user() in migratie 0045), niet pas bij een latere
 * mijlpaal zoals een eerste boeking. Bewuste, eenvoudige eerste versie:
 * een latere-mijlpaal-variant zou eerlijker zijn (voorkomt dat iemand
 * puur voor de credit een leeg account aanmaakt) maar vereist een aparte
 * "wanneer is een account 'actief'?"-definitie die nu nergens anders in
 * de app bestaat. Alleen leveranciers hebben iets aan spotlight-credits,
 * dus een organisator-uitnodiger krijgt hier stilzwijgend niets — dat
 * verandert vanzelf zodra diegene ook een leveranciersprofiel aanmaakt en
 * een volgende referral binnenhaalt.
 *
 * Wordt precies één keer aangeroepen, meteen na een geslaagde
 * signupAction (lib/actions/auth-actions.ts) — dus geen risico op dubbel
 * toekennen bij een latere hernieuwde aanroep.
 */
export async function grantReferralRewardIfEligible(referredUserId: string): Promise<void> {
  const supabase = await sb();
  const { data: profile } = await supabase.from("profiles").select("referred_by").eq("id", referredUserId).maybeSingle();
  const referrerId = profile?.referred_by as string | undefined;
  if (!referrerId) return;

  const { data: supplierRow } = await supabase.from("suppliers").select("id, bonus_spotlight_credits").eq("owner_id", referrerId).maybeSingle();
  if (!supplierRow) return;

  await supabase.from("suppliers").update({ bonus_spotlight_credits: (supplierRow.bonus_spotlight_credits ?? 0) + 1 }).eq("id", supplierRow.id);
  await pushNotification({
    userId: referrerId,
    eventId: null,
    type: "referral_reward",
    title: "Referral-beloning ontvangen",
    body: "Iemand heeft zich via jouw uitnodigingslink aangemeld — je hebt er een gratis spotlight-boost bij gekregen.",
    href: "/supplier/marketing",
  });
}

/** Hoeveel gebruikers zich via de referral-link van deze gebruiker hebben aangemeld — voor de tellerweergave in de UI. */
export async function countReferrals(userId: string): Promise<number> {
  const supabase = await sb();
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", userId);
  return count ?? 0;
}

/**
 * Verbruikt één bonus-spotlight-credit (van een referral of een
 * goedgekeurde boost-aanvraag) — atomair genoeg voor dit lage-volume
 * scenario: leest eerst het huidige aantal, schrijft daarna `huidig - 1`
 * met een `.gt("bonus_spotlight_credits", 0)`-voorwaarde in de query zelf,
 * zodat een gelijktijdige dubbele klik nooit onder 0 kan uitkomen.
 */
export async function consumeBonusSpotlightCredit(supplierId: string): Promise<boolean> {
  const supabase = await sb();
  const { data: current } = await supabase.from("suppliers").select("bonus_spotlight_credits").eq("id", supplierId).maybeSingle();
  const credits = current?.bonus_spotlight_credits ?? 0;
  if (credits <= 0) return false;
  const { data, error } = await supabase
    .from("suppliers")
    .update({ bonus_spotlight_credits: credits - 1 })
    .eq("id", supplierId)
    .gt("bonus_spotlight_credits", 0)
    .select("id");
  return !error && (data?.length ?? 0) > 0;
}

/**
 * "Losse Spotlight-boost" (livegang-audit) — zelfde vorm als
 * requestSupplierTierUpgrade (migratie 0040): Vyra verwerkt nog geen
 * betalingen zelf, dus dit is een AANVRAAG die Cem persoonlijk beoordeelt
 * (buiten de app om afgerekend, bijv. via een factuur) i.p.v. een directe
 * checkout. Geeft `null` terug bij een al bestaand openstaand verzoek.
 */
export async function requestSpotlightBoost(supplierId: string): Promise<SpotlightBoostRequest | null> {
  const supabase = await sb();
  const { data: existing } = await supabase
    .from("spotlight_boost_requests")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return null;

  const { data, error } = await supabase.from("spotlight_boost_requests").insert({ supplier_id: supplierId }).select().single();
  if (error || !data) return null;
  return rowToSpotlightBoostRequest(data);
}

export async function getPendingSpotlightBoostRequest(supplierId: string): Promise<SpotlightBoostRequest | null> {
  const supabase = await sb();
  const { data } = await supabase
    .from("spotlight_boost_requests")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToSpotlightBoostRequest(data) : null;
}

/** Admin-only: alle openstaande boost-aanvragen, met bedrijfsnaam erbij. Vereist service-role. */
export async function listPendingSpotlightBoostRequests(): Promise<(SpotlightBoostRequest & { companyName: string })[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase
    .from("spotlight_boost_requests")
    .select("*, supplier:suppliers(company_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data ?? [])
    .filter((r: Row) => r.supplier)
    .map((r: Row) => ({ ...rowToSpotlightBoostRequest(r), companyName: r.supplier.company_name }));
}

/**
 * Admin-only: keurt Cem een boost-aanvraag goed, dan krijgt de leverancier
 * er meteen +1 bonus_spotlight_credits bij (en een melding) — bij afwijzen
 * gebeurt er verder niets. Vereist service-role.
 */
export async function resolveSpotlightBoostRequest(
  requestId: string,
  status: "approved" | "declined",
  adminResponse: string | null
): Promise<SpotlightBoostRequest | null> {
  const admin = createSupabaseAdminClient();
  const supabase = admin ?? (await sb());
  // Livegang-audit (aug. 2026): `.eq("status", "pending")` toegevoegd zodat
  // dit niet-idempotent kan worden uitgevoerd — zonder deze voorwaarde gaf
  // een dubbele klik op "Goedkeuren" (of twee open admin-tabbladen) twee
  // keer een bonus-spotlight-credit voor dezelfde aanvraag, want de update
  // hieronder slaagde gewoon opnieuw op een al-afgehandelde rij. Slaagt de
  // update nu niet (want al niet meer "pending"), dan komt er ook geen
  // tweede credit bij.
  const { data, error } = await supabase
    .from("spotlight_boost_requests")
    .update({ status, admin_response: adminResponse, resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select()
    .single();
  if (error || !data) return null;
  const request = rowToSpotlightBoostRequest(data);

  if (status === "approved") {
    const { data: supplierRow } = await supabase.from("suppliers").select("id, owner_id, bonus_spotlight_credits").eq("id", request.supplierId).maybeSingle();
    if (supplierRow) {
      await supabase.from("suppliers").update({ bonus_spotlight_credits: (supplierRow.bonus_spotlight_credits ?? 0) + 1 }).eq("id", supplierRow.id);
      await pushNotification({
        userId: supplierRow.owner_id,
        eventId: null,
        type: "spotlight_boost_approved",
        title: "Losse Spotlight-boost goedgekeurd",
        body: "Je aanvraag is goedgekeurd — je hebt er een spotlight-boost bij, te gebruiken wanneer je maar wilt.",
        href: "/supplier/marketing",
      });
    }
  }

  return request;
}

/**
 * Alleen id + createdAt van elke vindbare ("open") leverancier — precies
 * genoeg voor de sitemap (spec-item #49), geen reden om daar het hele
 * profiel voor op te halen. Bewust GEEN limit(60) zoals `searchSupplierAccounts`
 * (dat is een UI-paginagrens, geen sitemap mag leveranciers overslaan). Een
 * gesloten leverancier (spec-item #55) hoort hier ook niet in — die is
 * bewust niet vindbaar, dus ook niet in de sitemap.
 */
export async function listOpenSupplierIdsForSitemap(): Promise<{ id: string; createdAt: string }[]> {
  const supabase = await sb();
  const { data } = await supabase.from("suppliers").select("id, created_at").eq("store_open", true);
  return (data ?? []).map((r: Row) => ({ id: r.id, createdAt: r.created_at }));
}

function rowToSavedSearch(r: Row): SavedSearch {
  return {
    id: r.id,
    userId: r.user_id,
    categoryKey: r.category_key ?? null,
    location: r.location ?? null,
    query: r.query ?? null,
    createdAt: r.created_at,
  };
}

/** Alle bewaarde zoekopdrachten van deze organisator (nieuwste eerst) — zie app/mijn-leveranciers/page.tsx. */
export async function getSavedSearchesForUser(userId: string): Promise<SavedSearch[]> {
  const supabase = await sb();
  const { data } = await supabase.from("saved_searches").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return (data ?? []).map(rowToSavedSearch);
}

export async function createSavedSearch(
  userId: string,
  filters: { categoryKey: SupplierCategory | null; location: string | null; query: string | null }
): Promise<SavedSearch | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({ user_id: userId, category_key: filters.categoryKey, location: filters.location, query: filters.query })
    .select()
    .single();
  if (error || !data) return null;
  return rowToSavedSearch(data);
}

export async function deleteSavedSearch(id: string, userId: string): Promise<void> {
  const supabase = await sb();
  await supabase.from("saved_searches").delete().eq("id", id).eq("user_id", userId);
}

/**
 * Meldt organisatoren wier bewaarde zoekopdracht bij deze NIEUWE leverancier
 * past — aangeroepen vanuit createSupplierAccount() bij het aanmelden.
 * Categorie moet overeenkomen (of de zoekopdracht had geen categoriefilter);
 * een bewaarde locatie moet voorkomen in de vestigingsplaats of het
 * werkgebied van de leverancier. Vrije zoektekst weegt bewust NIET mee in de
 * match (te onbetrouwbaar tegen een nog vers profiel zonder reviews/
 * portfolio) — die staat alleen ter herkenning bij de organisator zelf, zie
 * `describeSearch()` op app/mijn-leveranciers/page.tsx.
 */
async function notifyMatchingSavedSearches(supplier: SupplierAccount): Promise<void> {
  const supabase = await sb();
  const { data } = await supabase.from("saved_searches").select("*");
  const searches = (data ?? []).map(rowToSavedSearch);
  if (searches.length === 0) return;

  const locationHaystack = [supplier.baseLocation, ...supplier.serviceAreas].join(" ").toLowerCase();
  for (const search of searches) {
    const categoryMatches = !search.categoryKey || (supplier.categories as string[]).includes(search.categoryKey);
    const locationMatches = !search.location || locationHaystack.includes(search.location.toLowerCase());
    if (!categoryMatches || !locationMatches) continue;

    await pushNotification({
      userId: search.userId,
      eventId: null,
      type: "saved_search_match",
      title: "Nieuwe leverancier gevonden",
      body: `${supplier.companyName}${search.categoryKey ? ` (${SUPPLIER_CATEGORY_LABELS[search.categoryKey]})` : ""} past bij een bewaarde zoekopdracht van jou.`,
      href: `/leveranciers/${supplier.id}`,
    });
  }
}

export const MESSAGE_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024; // 8MB — royaal genoeg voor een foto of pdf-contract, klein genoeg om niet elk gesprek traag te laden.
const MESSAGE_ATTACHMENT_ALLOWED_MIME = (mime: string) => mime.startsWith("image/") || mime === "application/pdf";

/**
 * Uploadt een bijlage (foto/pdf) bij een bericht naar de PRIVATE
 * "message-attachments"-opslagruimte (migratie 0041) — in tegenstelling
 * tot `uploadSupplierFile` hieronder is deze ruimte NIET publiek leesbaar,
 * want een gesprek tussen één organisator en één leverancier kan een
 * contract of adres bevatten. `getMessages()` genereert daarom altijd een
 * tijdelijk ondertekende URL i.p.v. hier een publieke URL terug te geven.
 *
 * Pad-schema `${eventId}/${supplierId}/...` is bewust gelijk aan de
 * storage-RLS-policies in migratie 0041, die exact deze twee segmenten
 * gebruiken om te bepalen wie mag lezen/schrijven.
 */
export async function uploadMessageAttachment(
  eventId: string,
  supplierId: string,
  file: File
): Promise<{ storagePath: string; fileName: string; mimeType: string; sizeBytes: number } | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MESSAGE_ATTACHMENT_MAX_BYTES) return null;
  if (!MESSAGE_ATTACHMENT_ALLOWED_MIME(file.type)) return null;

  const supabase = await sb();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : file.type === "application/pdf" ? "pdf" : "jpg";
  const path = `${eventId}/${supplierId}/${Date.now()}-${Math.round(Math.random() * 1_000_000)}.${ext}`;
  const { error } = await supabase.storage.from("message-attachments").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) return null;
  return { storagePath: path, fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size };
}

/**
 * Uploadt een logo/foto naar de "supplier-media"-opslagruimte en geeft de
 * publieke URL terug (of null bij een fout). `folder: "review"` — sinds
 * "foto/video bij beoordelingen" (livegang-audit) — wordt ook door
 * ORGANISATOREN gebruikt (niet alleen leveranciers, ondanks de naam van
 * deze functie): een pad per `ownerId` is sowieso al de juiste vorm om
 * botsingen tussen verschillende gebruikers te voorkomen, dus hergebruik
 * hiervan i.p.v. een aparte, bijna-identieke functie.
 */
export async function uploadSupplierFile(ownerId: string, file: File, folder: "logo" | "gallery" | "cover" | "review"): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const supabase = await sb();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${ownerId}/${folder}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}.${ext}`;
  const { error } = await supabase.storage.from("supplier-media").upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) return null;
  const { data } = supabase.storage.from("supplier-media").getPublicUrl(path);
  return data.publicUrl;
}

const DISPLAY_GRADIENTS: [string, string][] = [
  ["#E8C9A8", "#B5674A"],
  ["#C9D4BC", "#6B7A5E"],
  ["#EAD9A8", "#B08A3E"],
  ["#C9CCC0", "#5C5748"],
  ["#E3C4B8", "#9C5540"],
  ["#BFCBC2", "#56634A"],
];

function gradientFor(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return DISPLAY_GRADIENTS[hash % DISPLAY_GRADIENTS.length];
}

/**
 * Zet een écht leveranciersaccount om naar de "weergave-vorm" die overal
 * (offertes, shortlist, gesprekken) wordt gebruikt om suppliers te tonen.
 * Async vanwege `tierBadge` — dat vraagt het huidige effectieve
 * abonnementsniveau op (proefperiode-aware, zie computeEffectiveTier()),
 * wat een databaseaanroep vergt (boekingentelling). Enige aanroeper is
 * `resolveSupplierDisplay` hieronder (zelf al async), dus dit raakt geen
 * andere call-sites.
 */
export async function supplierAccountToProfileShape(account: SupplierAccount): Promise<SupplierProfile> {
  const tierDefinition = await getSupplierEffectiveTierDefinition(account.id);
  return {
    id: account.id,
    companyName: account.companyName,
    contactPerson: account.contactPerson,
    category: account.category,
    serviceAreas: account.baseLocation ? [account.baseLocation] : account.serviceAreas,
    description: account.description,
    minPriceCents: account.minPriceCents,
    avgPriceCents: account.avgPriceCents,
    ratingAvg: account.ratingAvg,
    ratingCount: account.ratingCount,
    verified: account.verified,
    responseRateSummary: account.ratingCount > 0 || account.avgResponseHours < 24
      ? `Reageert meestal binnen ${account.avgResponseHours} uur`
      : "Nog geen reactiegeschiedenis",
    avgResponseHours: account.avgResponseHours,
    acceptedOfferRate: account.acceptedOfferRate,
    photoGradient: gradientFor(account.id),
    initials: account.companyName.slice(0, 2).toUpperCase(),
    tags: account.tags,
    yearsActive: account.yearsActive,
    portfolioHighlights: account.portfolioHighlights,
    isReal: true,
    logoUrl: account.logoUrl,
    tierBadge: tierDefinition.badge,
    packages: account.packages,
    tagline: account.tagline,
    coverPhotoUrl: account.coverPhotoUrl,
    introVideoUrl: account.introVideoUrl,
    lat: account.lat,
    lng: account.lng,
  };
}

/**
 * Zoekt een leverancier op id — eerst in de statische demo-catalogus,
 * anders in de echte (ingelogde) leveranciersaccounts. Zo blijven alle
 * plekken die een leverancier tonen (offertes, shortlist, afrekenen,
 * gesprekken) werken ongeacht of het om een demo- of een écht account gaat.
 */
export async function resolveSupplierDisplay(id: string): Promise<SupplierProfile | null> {
  const demo = getSupplierById(id);
  if (demo) return demo;
  const account = await getSupplierAccount(id);
  return account ? await supplierAccountToProfileShape(account) : null;
}

interface SupplierProfilePatch {
  companyName: string;
  contactPerson: string;
  categories: SupplierCategory[];
  categoryOther: string | null;
  baseLocation: string;
  serviceRadiusKm: number;
  description: string;
  minPriceCents: number;
  avgPriceCents: number;
  kvkNumber: string | null;
  website: string | null;
  socialFacebook: string | null;
  socialInstagram: string | null;
  socialTiktok: string | null;
  /** "Locatie op een kaart" — coördinaten van `baseLocation`, vooraf bepaald in de actie-laag via geocodeLocation() (lib/geo.ts). Null als geocoding niet lukte. */
  lat?: number | null;
  lng?: number | null;
  /** Optioneel al bij het aanmaken zelf (onboarding-nudge, livegang-audit: "foto + KVK bij onboarding") — daarvoor moest dit altijd via een latere profielbewerking. */
  logoUrl?: string | null;
}

export async function createSupplierAccount(ownerId: string, patch: SupplierProfilePatch): Promise<SupplierAccount> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      owner_id: ownerId,
      company_name: patch.companyName,
      contact_person: patch.contactPerson,
      category: patch.categories[0],
      categories: patch.categories,
      category_other: patch.categoryOther,
      service_areas: [patch.baseLocation],
      base_location: patch.baseLocation,
      service_radius_km: patch.serviceRadiusKm,
      description: patch.description,
      min_price_cents: patch.minPriceCents,
      avg_price_cents: patch.avgPriceCents,
      kvk_number: patch.kvkNumber,
      website: patch.website,
      social_facebook: patch.socialFacebook,
      social_instagram: patch.socialInstagram,
      social_tiktok: patch.socialTiktok,
      lat: patch.lat ?? null,
      lng: patch.lng ?? null,
      logo_url: patch.logoUrl ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Kon leveranciersprofiel niet aanmaken");
  // Rol bijwerken zodat de rest van de app (redirects e.d.) weet dat dit een leverancier is.
  await supabase.from("profiles").update({ role: "supplier" }).eq("id", ownerId);
  const account = rowToSupplierAccount(data);
  await notifyMatchingSavedSearches(account);
  return account;
}

export async function updateSupplierAccount(
  supplierId: string,
  patch: Partial<SupplierProfilePatch> & {
    logoUrl?: string | null;
    galleryUrls?: string[];
    tagline?: string | null;
    coverPhotoUrl?: string | null;
    introVideoUrl?: string | null;
  }
): Promise<SupplierAccount | null> {
  const supabase = await sb();
  const update: Row = {};
  if (patch.companyName !== undefined) update.company_name = patch.companyName;
  if (patch.contactPerson !== undefined) update.contact_person = patch.contactPerson;
  if (patch.categories !== undefined) {
    update.categories = patch.categories;
    update.category = patch.categories[0];
  }
  if (patch.categoryOther !== undefined) update.category_other = patch.categoryOther;
  if (patch.baseLocation !== undefined) {
    update.base_location = patch.baseLocation;
    update.service_areas = [patch.baseLocation];
  }
  if (patch.serviceRadiusKm !== undefined) update.service_radius_km = patch.serviceRadiusKm;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.minPriceCents !== undefined) update.min_price_cents = patch.minPriceCents;
  if (patch.avgPriceCents !== undefined) update.avg_price_cents = patch.avgPriceCents;
  if (patch.kvkNumber !== undefined) update.kvk_number = patch.kvkNumber;
  if (patch.website !== undefined) update.website = patch.website;
  if (patch.socialFacebook !== undefined) update.social_facebook = patch.socialFacebook;
  if (patch.socialInstagram !== undefined) update.social_instagram = patch.socialInstagram;
  if (patch.socialTiktok !== undefined) update.social_tiktok = patch.socialTiktok;
  if (patch.logoUrl !== undefined) update.logo_url = patch.logoUrl;
  if (patch.galleryUrls !== undefined) update.gallery_urls = patch.galleryUrls;
  if (patch.tagline !== undefined) update.tagline = patch.tagline;
  if (patch.coverPhotoUrl !== undefined) update.cover_photo_url = patch.coverPhotoUrl;
  if (patch.introVideoUrl !== undefined) update.intro_video_url = patch.introVideoUrl;
  if (patch.lat !== undefined) update.lat = patch.lat;
  if (patch.lng !== undefined) update.lng = patch.lng;
  const { data, error } = await supabase.from("suppliers").update(update).eq("id", supplierId).select().single();
  if (error || !data) return null;
  return rowToSupplierAccount(data);
}

/** Eigen, smal-scoped functie (net als hierboven) voor het Pro-perk "pakketten" — validatie (tier-gate, max 3, prijs) leeft in de Server Action, dit is een pure update. */
export async function updateSupplierPackages(supplierId: string, packages: SupplierPackage[]): Promise<SupplierAccount | null> {
  const supabase = await sb();
  const { data, error } = await supabase.from("suppliers").update({ packages }).eq("id", supplierId).select().single();
  if (error || !data) return null;
  return rowToSupplierAccount(data);
}

// Bewust een eigen, smal-scoped functie i.p.v. `verified`/`verificationRequestedAt`
// toevoegen aan `updateSupplierAccount`'s patch-whitelist: die functie wordt
// vanuit leverancier-eigen Server Actions aangeroepen (RLS-scoped, alleen
// eigen rij), en `verified` mag NOOIT via een pad instelbaar zijn dat een
// leverancier zelf kan aanroepen. Hier zetten we alleen het aanvraag-
// tijdstip; de daadwerkelijke goedkeuring loopt via de admin-only acties
// hieronder (`approveSupplierVerification`/`rejectSupplierVerification`),
// die de service-role client gebruiken.
export async function requestSupplierVerification(supplierId: string): Promise<SupplierAccount | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("suppliers")
    .update({ verification_requested_at: new Date().toISOString() })
    .eq("id", supplierId)
    .select()
    .single();
  if (error || !data) return null;
  return rowToSupplierAccount(data);
}

/** Admin-only: keurt een verificatieaanvraag goed — zet `verified = true`. Vereist service-role. */
export async function approveSupplierVerification(supplierId: string): Promise<SupplierAccount | null> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data, error } = await supabase
    .from("suppliers")
    .update({ verified: true, verification_requested_at: null })
    .eq("id", supplierId)
    .select()
    .single();
  if (error || !data) return null;
  return rowToSupplierAccount(data);
}

/** Admin-only: wijst een verificatieaanvraag af — laat `verified` ongemoeid, wist de aanvraag. Vereist service-role. */
export async function rejectSupplierVerification(supplierId: string): Promise<SupplierAccount | null> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data, error } = await supabase
    .from("suppliers")
    .update({ verification_requested_at: null })
    .eq("id", supplierId)
    .select()
    .single();
  if (error || !data) return null;
  return rowToSupplierAccount(data);
}

/**
 * Admin-only: trekt een eerder toegekende verificatie weer in — zet
 * `verified` terug naar `false`. Was er tot nu toe niet: eenmaal
 * goedgekeurd kon een leverancier nooit meer worden teruggezet, ook niet
 * als later bleek dat de KVK-gegevens toch niet klopten of er misbruik
 * werd geconstateerd. Wist bewust NIET `verification_requested_at` (die
 * stond hier al op `null` sinds de goedkeuring) — een leverancier die
 * opnieuw geverifieerd wil worden, moet dat zelf, bewust, opnieuw
 * aanvragen vanuit zijn profiel. Vereist service-role.
 */
export async function revokeSupplierVerification(supplierId: string): Promise<SupplierAccount | null> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data, error } = await supabase
    .from("suppliers")
    .update({ verified: false })
    .eq("id", supplierId)
    .select()
    .single();
  if (error || !data) return null;
  return rowToSupplierAccount(data);
}

/* ------------------------------------------------------------------ */
/* LEVERANCIER — BESCHIKBAARHEID (geblokkeerde datums)                 */
/* ------------------------------------------------------------------ */

export async function getSupplierBlockedDates(supplierId: string): Promise<SupplierBlockedDate[]> {
  const supabase = await sb();
  const { data } = await supabase.from("supplier_blocked_dates").select("*").eq("supplier_id", supplierId).order("date", { ascending: true });
  return (data ?? []).map(rowToSupplierBlockedDate);
}

/** RLS-scoped (owner-only via policy) — leverancier blokkeert een datum in zijn eigen kalender. */
export async function blockSupplierDate(supplierId: string, date: string): Promise<SupplierBlockedDate | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("supplier_blocked_dates")
    .insert({ supplier_id: supplierId, date })
    .select()
    .single();
  if (error || !data) return null;
  return rowToSupplierBlockedDate(data);
}

/** Bovengrens op het aantal dagen dat in één actie geblokkeerd kan worden — vangt een tikfout in de einddatum op (bv. verkeerd jaar) voordat die honderden rijen aanmaakt. */
const MAX_BLOCKED_DATE_RANGE_DAYS = 366;

/**
 * Blokkeer een hele reeks datums in één keer (bv. een vakantie van twee
 * weken) i.p.v. dag voor dag — spec-item #54-vervolg: Cem gaf aan dat de
 * losse datumkiezer niet praktisch is voor langere periodes. Inclusief
 * `startDate` en `endDate`. Rekent in UTC-dagen (i.p.v. lokale tijd +1
 * dag optellen) om DST-fouten rond de klokomzetting te vermijden. Gebruikt
 * `upsert`+`ignoreDuplicates` zodat een datum die al geblokkeerd was de
 * actie niet laat mislukken.
 */
export async function blockSupplierDateRange(
  supplierId: string,
  startDate: string,
  endDate: string
): Promise<{ ok: boolean; error?: string; dates: string[] }> {
  if (startDate > endDate) return { ok: false, error: "De startdatum moet vóór (of gelijk aan) de einddatum liggen.", dates: [] };

  const dates: string[] = [];
  let cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    if (dates.length > MAX_BLOCKED_DATE_RANGE_DAYS) {
      return { ok: false, error: `Een reeks van meer dan ${MAX_BLOCKED_DATE_RANGE_DAYS} dagen tegelijk wordt niet ondersteund — controleer de datums.`, dates: [] };
    }
  }

  const supabase = await sb();
  const { error } = await supabase
    .from("supplier_blocked_dates")
    .upsert(
      dates.map((date) => ({ supplier_id: supplierId, date })),
      { onConflict: "supplier_id,date", ignoreDuplicates: true }
    );
  if (error) return { ok: false, error: "Kon deze datums niet blokkeren.", dates: [] };
  return { ok: true, dates };
}

export async function unblockSupplierDate(supplierId: string, date: string): Promise<void> {
  const supabase = await sb();
  await supabase.from("supplier_blocked_dates").delete().eq("supplier_id", supplierId).eq("date", date);
}

/* ------------------------------------------------------------------ */
/* LEVERANCIER — TERUGKERENDE BESCHIKBAARHEID (weekdag-blokkade)        */
/* spec-item #128                                                       */
/* ------------------------------------------------------------------ */

export async function getSupplierRecurringBlocks(supplierId: string): Promise<SupplierRecurringBlock[]> {
  const supabase = await sb();
  const { data } = await supabase.from("supplier_recurring_blocks").select("*").eq("supplier_id", supplierId).order("weekday", { ascending: true });
  return (data ?? []).map(rowToSupplierRecurringBlock);
}

/**
 * Zet/heft een structurele weekdag-blokkade op ("elke maandag niet
 * beschikbaar") — zelfde toggle-vorm als `toggleSupplierBlockedDateAction`
 * voor eenmalige datums. `weekday`: 0=maandag..6=zondag (zie de toelichting
 * bij `SupplierRecurringBlock` in lib/types.ts).
 */
export async function setSupplierRecurringBlock(supplierId: string, weekday: number, blocked: boolean): Promise<{ ok: boolean }> {
  const supabase = await sb();
  if (blocked) {
    // upsert+ignoreDuplicates i.p.v. plain insert: idempotent bij een dubbele
    // klik (dezelfde reden als blockSupplierDateRange hierboven).
    const { error } = await supabase
      .from("supplier_recurring_blocks")
      .upsert({ supplier_id: supplierId, weekday }, { onConflict: "supplier_id,weekday", ignoreDuplicates: true });
    if (error) return { ok: false };
  } else {
    await supabase.from("supplier_recurring_blocks").delete().eq("supplier_id", supplierId).eq("weekday", weekday);
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* LEVERANCIER — iCAL-AGENDA-ABONNEMENT (spec-item #128)                */
/* Zie de toelichting bovenaan supabase/migrations/0046_...sql voor     */
/* waarom dit een aparte, NIET publiek leesbare tabel is i.p.v. een     */
/* kolom op `suppliers`.                                                */
/* ------------------------------------------------------------------ */

/**
 * Geeft de bestaande token van deze leverancier terug, of maakt er (via de
 * eigen, RLS-scoped sessie — geen service-role nodig) meteen één aan als
 * die nog niet bestaat. Wordt aangeroepen vanaf /supplier/calendar zodra de
 * eigenaar zelf is ingelogd, dus `sb()` (de gewone sessie-client) volstaat
 * hier — pas de externe .ics-route zelf (geen sessie) heeft de service-role
 * nodig, zie `getSupplierIdByIcalToken`.
 */
export async function getOrCreateSupplierIcalToken(supplierId: string): Promise<string | null> {
  const supabase = await sb();
  const { data: existing } = await supabase.from("supplier_ical_tokens").select("token").eq("supplier_id", supplierId).maybeSingle();
  if (existing?.token) return existing.token as string;

  const { data, error } = await supabase.from("supplier_ical_tokens").insert({ supplier_id: supplierId }).select("token").single();
  if (error || !data) return null;
  return data.token as string;
}

/** Vervangt de bestaande token door een nieuwe (bv. als de oude per ongeluk gedeeld is) — de oude abonnement-URL stopt daarna direct met werken. */
export async function regenerateSupplierIcalToken(supplierId: string): Promise<string | null> {
  const supabase = await sb();
  await supabase.from("supplier_ical_tokens").delete().eq("supplier_id", supplierId);
  const { data, error } = await supabase.from("supplier_ical_tokens").insert({ supplier_id: supplierId }).select("token").single();
  if (error || !data) return null;
  return data.token as string;
}

/**
 * Voor de .ics-route zelf: een externe agenda-app stuurt geen Vyra-sessie
 * mee, dus dit MOET via de service-role-sleutel lopen (RLS zou een
 * niet-ingelogde aanvraag anders altijd blokkeren — precies de bedoeling
 * van de "geen publieke leespolicy" op deze tabel). Geeft `null` terug als
 * de service-role niet is geconfigureerd óf de token onbekend is — de route
 * behandelt beide gevallen hetzelfde (404), om niet per ongeluk te
 * verklappen welke van de twee het is.
 */
export async function getSupplierIdByIcalToken(token: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("supplier_ical_tokens").select("supplier_id").eq("token", token).maybeSingle();
  return (data?.supplier_id as string | undefined) ?? null;
}

/**
 * Bevestigde boekingen voor de .ics-route zelf — BEWUST via de service-role
 * i.p.v. de gewone `getSupplierOrders()` hierboven. Die laatste gebruikt
 * `sb()` (de sessie-client) en werkt daardoor prima op /supplier/orders,
 * waar de leverancier zelf is ingelogd — maar de `offers`/`payments`-RLS-
 * policies staan select alleen toe aan de eigenaar zelf (`auth.uid()`), dus
 * bij een écht sessieloze aanvraag van een externe agenda-app (geen
 * Vyra-cookie, precies het scenario waar deze route voor bestaat) zou
 * `getSupplierOrders()` altijd een lege lijst teruggeven — geen fout, maar
 * een stilzwijgend LEEG abonnement, ongeacht hoeveel boekingen er echt
 * zijn. De token-verificatie hiervoor in de route (`getSupplierIdByIcalToken`)
 * is al de enige autorisatie die nodig is, dus hier evenzo de service-role
 * gebruiken past bij hetzelfde vertrouwensniveau. Alleen wat de .ics-feed
 * nodig heeft (offerte + evenement) — geen betaalgegevens, die staan hier
 * toch niet in.
 */
export async function getSupplierOrdersForIcalFeed(supplierId: string): Promise<Array<{ offer: OfferOption; event: EventCore | null }>> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("offers")
    .select("*, event:events(*)")
    .eq("supplier_id", supplierId)
    .eq("status", "accepted")
    .order("responded_at", { ascending: false });
  return (data ?? []).map((o: Row) => ({ offer: rowToOffer(o), event: o.event ? rowToEvent(o.event) : null }));
}

/* ------------------------------------------------------------------ */
/* ORGANISATOR — FAVORIETE LEVERANCIERS (spec-item #54: terugkeer)     */
/* ------------------------------------------------------------------ */

/**
 * Alle op dit moment RLS-scoped (eigen `user_id`) opgeslagen favorieten,
 * inclusief het volledige leveranciersprofiel — zodat de overzichtspagina
 * geen aparte N+1-lookups hoeft te doen. Bewust `!inner`-embedding i.p.v.
 * een losse tweede query: hier is er precies één relatie (favorite → zijn
 * eigen leverancier) en geen event-datumfilter nodig, dus levert de
 * PostgREST-embed hier geen risico op zoals bij `getUnavailableSupplierIds`.
 */
export async function listFavoriteSuppliers(userId: string): Promise<{ favorite: SupplierFavorite; supplier: SupplierAccount }[]> {
  const supabase = await sb();
  const { data } = await supabase
    .from("supplier_favorites")
    .select("*, supplier:suppliers!inner(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? [])
    .filter((r: Row) => r.supplier)
    .map((r: Row) => ({ favorite: rowToSupplierFavorite(r), supplier: rowToSupplierAccount(r.supplier) }));
}

/**
 * Kruislink tussen "Mijn leveranciers" (globale favorieten) en de
 * per-evenement shortlist (livegang-audit: "shortlist en Mijn leveranciers
 * kruislinken", tot nu toe twee losse eilandjes zonder enige verwijzing
 * naar elkaar). Voor elke opgegeven favoriete leverancier: in welke van de
 * evenementen van deze gebruiker heeft die leverancier op dit moment een
 * geaccepteerde offerte of staat hij op de shortlist? Twee aparte
 * query's i.p.v. één geneste join — de FK-naam van offers→events is niet
 * zeker genoeg om blind op te vertrouwen, en dit blijft bij een paar
 * evenementen sowieso goedkoper dan een grote geneste select.
 */
export async function getFavoriteSupplierEngagements(
  userId: string,
  supplierIds: string[]
): Promise<Map<string, { eventId: string; eventName: string; categoryKey: SupplierCategory }[]>> {
  const result = new Map<string, { eventId: string; eventName: string; categoryKey: SupplierCategory }[]>();
  if (supplierIds.length === 0) return result;
  const events = await listEventsForUser(userId);
  if (events.length === 0) return result;
  const eventById = new Map(events.map((e) => [e.id, e]));

  const supabase = await sb();
  const { data } = await supabase
    .from("offers")
    .select("event_id, supplier_id, category_key, status, swipe_decision")
    .in("event_id", events.map((e) => e.id))
    .in("supplier_id", supplierIds);

  for (const row of data ?? []) {
    if (row.status !== "accepted" && row.swipe_decision !== "shortlisted") continue;
    const event = eventById.get(row.event_id);
    if (!event) continue;
    const list = result.get(row.supplier_id) ?? [];
    // Eén leverancier kan in principe voor meerdere categorieën/evenementen
    // actief zijn — dedupliceren op event+categorie voorkomt dubbele regels
    // als er ooit meerdere offertes van dezelfde leverancier in dezelfde
    // categorie tegelijk "shortlisted" staan.
    if (!list.some((x) => x.eventId === event.id && x.categoryKey === row.category_key)) {
      list.push({ eventId: event.id, eventName: event.name, categoryKey: row.category_key });
    }
    result.set(row.supplier_id, list);
  }
  return result;
}

/** RLS beperkt dit al tot de huidige gebruiker — geen expliciete userId-check nodig. */
export async function isSupplierFavorited(supplierId: string): Promise<boolean> {
  const supabase = await sb();
  const { data } = await supabase.from("supplier_favorites").select("id").eq("supplier_id", supplierId).limit(1);
  return (data?.length ?? 0) > 0;
}

export async function addSupplierFavorite(userId: string, supplierId: string): Promise<void> {
  const supabase = await sb();
  // upsert met `ignoreDuplicates` i.p.v. eerst controleren + dan pas
  // invoegen: voorkomt een race (dubbelklik) en de unique-constraint
  // gooit hierdoor nooit een fout.
  await supabase.from("supplier_favorites").upsert(
    { user_id: userId, supplier_id: supplierId },
    { onConflict: "user_id,supplier_id", ignoreDuplicates: true }
  );
}

export async function removeSupplierFavorite(supplierId: string): Promise<void> {
  const supabase = await sb();
  await supabase.from("supplier_favorites").delete().eq("supplier_id", supplierId);
}

/**
 * Heeft de huidige (ingelogde) organisator deze leverancier al ergens benaderd
 * — via een gematchte of rechtstreekse aanvraag? Gebruikt om de directe
 * contactlinks (website/social media) op het publieke profiel pas te tonen
 * ná het eerste contact via Vyra, i.p.v. dat iedere bezoeker er meteen
 * omheen kan (spec-item #54). RLS op `request_targets` scopet dit al tot
 * aanvragen van events die van de ingelogde gebruiker zijn — vandaar geen
 * expliciete userId-parameter nodig, zelfde patroon als `isSupplierFavorited`.
 */
export async function hasOrganizerContactedSupplier(supplierId: string): Promise<boolean> {
  const supabase = await sb();
  const { data } = await supabase.from("request_targets").select("id").eq("supplier_id", supplierId).limit(1);
  return (data?.length ?? 0) > 0;
}

/* ------------------------------------------------------------------ */
/* ORGANISATOR — GENOEMDE COLLECTIES VOOR FAVORIETEN (spec-item #129)   */
/* ------------------------------------------------------------------ */

export async function listFavoriteCollections(userId: string): Promise<SupplierFavoriteCollection[]> {
  const supabase = await sb();
  const { data } = await supabase.from("supplier_favorite_collections").select("*").eq("user_id", userId).order("created_at", { ascending: true });
  return (data ?? []).map(rowToSupplierFavoriteCollection);
}

export async function createFavoriteCollection(userId: string, name: string): Promise<SupplierFavoriteCollection | null> {
  const supabase = await sb();
  const { data, error } = await supabase.from("supplier_favorite_collections").insert({ user_id: userId, name }).select().single();
  if (error || !data) return null;
  return rowToSupplierFavoriteCollection(data);
}

export async function renameFavoriteCollection(collectionId: string, userId: string, name: string): Promise<boolean> {
  const supabase = await sb();
  const { error } = await supabase.from("supplier_favorite_collections").update({ name }).eq("id", collectionId).eq("user_id", userId);
  return !error;
}

/** Verwijdert alleen de collectie zelf — de favorieten die erin zaten blijven bestaan en vallen terug op "Niet ingedeeld" (`collection_id` wordt `null` via `on delete set null`, migratie 47). */
export async function deleteFavoriteCollection(collectionId: string, userId: string): Promise<void> {
  const supabase = await sb();
  await supabase.from("supplier_favorite_collections").delete().eq("id", collectionId).eq("user_id", userId);
}

/**
 * Verplaatst een favoriet naar een (andere) collectie, of terug naar "Niet
 * ingedeeld" (`collectionId = null`). Filtert op `user_id` i.p.v. enkel
 * `supplier_id` — een favoriet-rij is uniek per (user, supplier), maar deze
 * extra check is defense-in-depth zodat een verkeerd meegegeven supplierId
 * nooit andermans favoriet zou kunnen raken (RLS blokkeert dat sowieso al).
 */
export async function moveFavoriteToCollection(userId: string, supplierId: string, collectionId: string | null): Promise<boolean> {
  const supabase = await sb();
  const { error } = await supabase
    .from("supplier_favorites")
    .update({ collection_id: collectionId })
    .eq("user_id", userId)
    .eq("supplier_id", supplierId);
  return !error;
}

/* ------------------------------------------------------------------ */
/* BROWSER-PUSHMELDINGEN (spec-item #131)                               */
/* Alleen de gebruiker-gerichte CRUD hier — de cronjob die daadwerkelijk */
/* pushmeldingen VERSTUURT (app/api/cron/supplier-proactive-signals)    */
/* loopt via zijn eigen service-role-query, zelfde reden als elders in  */
/* dit bestand: geen ingelogde sessie in een cronjob.                   */
/* ------------------------------------------------------------------ */

function rowToPushSubscription(r: Row): PushSubscriptionRecord {
  return { id: r.id, userId: r.user_id, endpoint: r.endpoint, p256dh: r.p256dh, authKey: r.auth_key, createdAt: r.created_at };
}

export async function getPushSubscriptionsForUser(userId: string): Promise<PushSubscriptionRecord[]> {
  const supabase = await sb();
  const { data } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
  return (data ?? []).map(rowToPushSubscription);
}

/**
 * Slaat een browser-push-abonnement op — `onConflict: "endpoint"` i.p.v.
 * een losse insert: dezelfde browser/apparaat kan zich opnieuw abonneren
 * (bv. na het wissen van site-gegevens) met hetzelfde endpoint maar nieuwe
 * sleutels, dan werken we het bestaande record gewoon bij i.p.v. een
 * unique-constraint-fout te geven.
 */
export async function savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; authKey: string }): Promise<boolean> {
  const supabase = await sb();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth_key: sub.authKey }, { onConflict: "endpoint" });
  return !error;
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  const supabase = await sb();
  await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
}

/* ------------------------------------------------------------------ */
/* COMMISSIEMODEL (spec-item #53: instaptarief / gestaffeld / Pro)     */
/* ------------------------------------------------------------------ */

/**
 * Aantal succesvol AFGERONDE boekingen van deze leverancier tot nu toe —
 * bepaalt of hij nog in zijn proefperiode zit (zie `TRIAL_BOOKING_COUNT`
 * in lib/config.ts). Telt op `offers.status === "accepted"`, want dat is
 * precies het moment waarop `createPaymentForOffer` ook al een boeking
 * beschouwt (zie ook `getSupplierOrders` hierboven, dat dezelfde telling
 * gebruikt voor het bestelloverzicht). `excludeOfferId` laat de boeking die
 * je op dit moment aan het afrekenen bent buiten de telling — anders zou
 * boeking 5 zichzelf al als "boeking 6" meetellen.
 */
async function countAcceptedOffersForSupplier(supplierId: string, excludeOfferId?: string): Promise<number> {
  const supabase = await sb();
  let query = supabase.from("offers").select("id", { count: "exact", head: true }).eq("supplier_id", supplierId).eq("status", "accepted");
  if (excludeOfferId) query = query.neq("id", excludeOfferId);
  const { count } = await query;
  return count ?? 0;
}

/**
 * Puur, synchrone regel voor welke laag op dit moment geldt voor een
 * leverancier — de proefperiode gaat altijd voor (spec-item #53-vervolg,
 * SaaS-pivot): zolang een leverancier nog geen `TRIAL_BOOKING_COUNT`
 * bevestigde boekingen heeft, ervaart hij het volledige platform gratis,
 * ongeacht welk abonnement hij eventueel al heeft gekozen. Los van de
 * database-aanroepen gehouden zodat `findRealMatchingSuppliers` hem kan
 * hergebruiken zonder de leverancier een tweede keer op te hoeven halen.
 */
function computeEffectiveTier(supplier: SupplierAccount, priorAcceptedBookings: number): EffectiveSupplierTier {
  return priorAcceptedBookings < TRIAL_BOOKING_COUNT ? "trial" : supplier.subscriptionTier;
}

/**
 * Welk abonnementsniveau (of de proefperiode) geldt op dit moment voor deze
 * leverancier? Gebruikt zowel bij het daadwerkelijk aanmaken van een
 * betaling (`createPaymentForOffer`) als puur informatief op het
 * leveranciersprofiel (`getSupplierCommissionStatus`).
 */
export async function resolveEffectiveSupplierTier(supplierId: string, excludeOfferId?: string): Promise<EffectiveSupplierTier> {
  const supplier = await getSupplierAccount(supplierId);
  if (!supplier) return "instap"; // defensief vangnet; "instap" is sinds aug. 2026 de default voor nieuwe leveranciers
  const priorBookings = await countAcceptedOffersForSupplier(supplierId, excludeOfferId);
  return computeEffectiveTier(supplier, priorBookings);
}

/** De volledige tier-definitie (perks, limieten, commissie) die op dit moment voor deze leverancier geldt. */
export async function getSupplierEffectiveTierDefinition(supplierId: string) {
  const tier = await resolveEffectiveSupplierTier(supplierId);
  return getEffectiveTierDefinition(tier);
}

/** Welke VyrAI-assistent-feature een aanroep telt — puur informatief, zie migratie 0036. */
export type SupplierAssistantFeature = "chat" | "reply_draft" | "offer_helper" | "briefing" | "price_advice" | "profile_text";

/**
 * Hoeveel VyrAI-assistent-aanroepen (alle features samen) deze leverancier
 * vandaag al heeft gedaan — tegen `assistantDailyLimit` in lib/config.ts.
 * Gebruikt de gewone sessie-client (RLS "eigenaar leest eigen gebruik",
 * migratie 0036) — bewust GEEN service-role nodig, zie de toelichting in
 * die migratie.
 */
export async function countSupplierAssistantUsageToday(supplierId: string): Promise<number> {
  const supabase = await sb();
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { count } = await supabase
    .from("supplier_assistant_usage")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .gte("created_at", startOfDay);
  return count ?? 0;
}

/**
 * Logt één VyrAI-assistent-aanroep (voor de dagelijkse limiet hierboven).
 * Best-effort: een schrijffout hier mag de assistent-functie zelf nooit
 * laten crashen — zelfde aanpak als logAiInteraction() hieronder. Als
 * loggen faalt, telt deze aanroep simpelweg niet mee voor de limiet (fail
 * open, niet fail closed) — een betalende klant mag nooit onterecht
 * geblokkeerd worden door een logging-storing.
 */
export async function logSupplierAssistantUsage(supplierId: string, feature: SupplierAssistantFeature): Promise<void> {
  try {
    const supabase = await sb();
    await supabase.from("supplier_assistant_usage").insert({ supplier_id: supplierId, feature });
  } catch (err) {
    console.error("[supplier_assistant_usage] Kon gebruik niet loggen.", err);
  }
}

/**
 * Centrale limietcontrole voor élke VyrAI-assistent-feature — geeft
 * `{ allowed: true }` of `{ allowed: false, reason }` terug, nooit een
 * exception (dezelfde "nooit crashen op een AI-randgeval"-filosofie als
 * lib/ai/client.ts). Controleert zowel of het abonnement er überhaupt
 * toegang toe heeft (`assistantTier`) als de dagelijkse limiet
 * (`assistantDailyLimit`, null = onbeperkt). Logt het gebruik ZELF niet —
 * dat doet de aanroeper pas na een geslaagde AI-aanroep, via
 * logSupplierAssistantUsage(), zodat een geweigerde aanroep niet toch nog
 * meetelt.
 */
/**
 * "Resterende VyrAI-limiet zichtbaar maken" (livegang-audit) — tot nu toe
 * ontdekte een leverancier zijn dagelijkse limiet alleen ACHTERAF, via de
 * afwijzende tekst die checkSupplierAssistantAccess() teruggeeft ná een
 * mislukte poging. Dit geeft dezelfde cijfers vooraf, zodat de UI
 * (SupplierAssistantWidget) het gewoon kan tonen — `limit: null` betekent
 * onbeperkt (alleen de proefperiode), niet "geen toegang"; dat laatste
 * wordt al apart afgedwongen via `assistantTier`.
 */
export async function getSupplierAssistantUsageStatus(supplierId: string): Promise<{ used: number; limit: number | null }> {
  const tierDefinition = await getSupplierEffectiveTierDefinition(supplierId);
  if (tierDefinition.assistantDailyLimit == null) return { used: 0, limit: null };
  const used = await countSupplierAssistantUsageToday(supplierId);
  return { used, limit: tierDefinition.assistantDailyLimit };
}

export async function checkSupplierAssistantAccess(
  supplierId: string,
  requiredTier: 1 | 2 = 1
): Promise<{ allowed: true } | { allowed: false; reason: "geen_toegang" | "limiet_bereikt" }> {
  const tierDefinition = await getSupplierEffectiveTierDefinition(supplierId);
  if (tierDefinition.assistantTier < requiredTier) {
    return { allowed: false, reason: "geen_toegang" };
  }
  if (tierDefinition.assistantDailyLimit == null) {
    return { allowed: true };
  }
  const usedToday = await countSupplierAssistantUsageToday(supplierId);
  if (usedToday >= tierDefinition.assistantDailyLimit) {
    return { allowed: false, reason: "limiet_bereikt" };
  }
  return { allowed: true };
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Signalen voor de dagelijkse prioriteitenbriefing (Premium+, spec-item
 * #57): korte, feitelijke Nederlandse zinnen, geen AI — de narratieve toon
 * komt pas bij narrateSupplierBriefing() (lib/ai/supplierAssistant.ts).
 * Bewust dezelfde soort signalen als de admin-briefing (verlopende
 * termijnen, stilgevallen zaken), maar dan geschaald naar wat één
 * leverancier zelf kan beïnvloeden.
 */
async function computeSupplierBriefingSignals(supplierId: string): Promise<string[]> {
  const [leads, orders] = await Promise.all([getSupplierLeads(supplierId), getSupplierOrders(supplierId)]);
  const now = Date.now();
  const signals: string[] = [];

  const pending = leads.filter((l) => l.target.status === "pending");
  const expiringSoon = pending.filter((l) => {
    const hoursLeft = (new Date(l.request.deadlineAt).getTime() - now) / (1000 * 60 * 60);
    return hoursLeft > 0 && hoursLeft <= 24;
  });
  for (const lead of expiringSoon) {
    signals.push(
      `Aanvraag "${SUPPLIER_CATEGORY_LABELS[lead.request.categoryKey]}" voor ${lead.event.name} verloopt over minder dan 24 uur — nog geen reactie verstuurd.`
    );
  }
  if (pending.length > expiringSoon.length) {
    const restCount = pending.length - expiringSoon.length;
    signals.push(`Nog ${restCount} andere openstaande aanvra${restCount === 1 ? "ag wacht" : "gen wachten"} op een reactie.`);
  }

  const upcomingWeek = orders.filter((o) => {
    if (!o.event?.date) return false;
    const daysUntil = (new Date(o.event.date).getTime() - now) / (1000 * 60 * 60 * 24);
    return daysUntil >= 0 && daysUntil <= 7;
  });
  for (const order of upcomingWeek) {
    signals.push(`Boeking "${SUPPLIER_CATEGORY_LABELS[order.offer.categoryKey]}" voor ${order.event!.name} vindt binnen 7 dagen plaats.`);
  }

  return signals;
}

function rowToSupplierDailyBriefing(r: Row): { narrative: string; usedAI: boolean; briefingDate: string } {
  return { narrative: r.narrative, usedAI: r.used_ai, briefingDate: r.briefing_date };
}

/** Alleen lezen — geeft null als er voor vandaag nog geen briefing is gegenereerd. Geen AI-aanroep, dus geen impact op de dagelijkse limiet. */
export async function getCachedSupplierBriefing(supplierId: string): Promise<{ narrative: string; usedAI: boolean } | null> {
  const supabase = await sb();
  const { data } = await supabase
    .from("supplier_daily_briefings")
    .select("narrative, used_ai, briefing_date")
    .eq("supplier_id", supplierId)
    .eq("briefing_date", todayDateStr())
    .maybeSingle();
  return data ? rowToSupplierDailyBriefing(data) : null;
}

/**
 * Genereert (en cachet) de dagelijkse briefing voor vandaag. Idempotent per
 * kalenderdag: geeft de al-gecachete versie terug als die er al is (zonder
 * opnieuw AI aan te roepen of de dagelijkse limiet te tellen) — de
 * aanroepende server action (generateSupplierBriefingAction) telt alleen
 * verbruik bij `cached: false`.
 */
export async function generateAndCacheSupplierBriefing(supplierId: string, ownerId: string): Promise<{ narrative: string; usedAI: boolean; cached: boolean }> {
  const existing = await getCachedSupplierBriefing(supplierId);
  if (existing) return { ...existing, cached: true };

  const signals = await computeSupplierBriefingSignals(supplierId);
  const { narrative, usedAI } = await narrateSupplierBriefing({ ownerId, signals });

  const supabase = await sb();
  // insert i.p.v. upsert: bij een gelijktijdige dubbele aanroep (bv. twee
  // tabbladen tegelijk) wint de unique-constraint (migratie 0037) en faalt
  // de tweede insert stil — dat is prima, we lezen daarna gewoon opnieuw de
  // (inmiddels bestaande) gecachete rij terug i.p.v. een fout te tonen.
  const { error } = await supabase
    .from("supplier_daily_briefings")
    .insert({ supplier_id: supplierId, briefing_date: todayDateStr(), narrative, signal_count: signals.length, used_ai: usedAI });
  if (error) {
    const cached = await getCachedSupplierBriefing(supplierId);
    if (cached) return { ...cached, cached: true };
  }
  return { narrative, usedAI, cached: false };
}

/** Voor weergave op het leveranciersprofiel: huidige laag + hoeveel proefboekingen er nog over zijn. */
export async function getSupplierCommissionStatus(supplierId: string): Promise<{
  tier: EffectiveSupplierTier;
  inTrial: boolean;
  acceptedBookingsCount: number;
  trialBookingsRemaining: number;
}> {
  const [tier, acceptedBookingsCount] = await Promise.all([
    resolveEffectiveSupplierTier(supplierId),
    countAcceptedOffersForSupplier(supplierId),
  ]);
  return {
    tier,
    inTrial: tier === "trial",
    acceptedBookingsCount,
    trialBookingsRemaining: Math.max(0, TRIAL_BOOKING_COUNT - acceptedBookingsCount),
  };
}

/**
 * Zet het abonnementsniveau rechtstreeks in de database — GEEN geldstroom,
 * dus alleen te gebruiken voor het gratis Instap-niveau, of als onderdeel
 * van de admin-goedkeuringsflow (`resolveTierUpgradeRequest`)/de handmatige
 * fallback wanneer Stripe nog niet geconfigureerd is (zie
 * `changeSubscriptionTierAction` in lib/actions/supplier-actions.ts). Voor
 * een betaald niveau met Stripe wél geconfigureerd loopt het bijwerken van
 * dit veld altijd via de webhook (`applySupplierSubscriptionFromWebhook`
 * hieronder), nooit via deze functie — anders zou de database een niveau
 * kunnen tonen waar nooit voor betaald is.
 */
export async function setSupplierSubscriptionTier(supplierId: string, tier: SubscriptionTier): Promise<void> {
  const supabase = await sb();
  await supabase.from("suppliers").update({ subscription_tier: tier }).eq("id", supplierId);
}

/**
 * Legt een nieuw (of hergebruikt) Stripe-klant-id vast op het moment dat een
 * leverancier voor het eerst een betaald niveau kiest (zie
 * changeSubscriptionTierAction in lib/actions/supplier-actions.ts) — zodat
 * een volgende checkout/wijziging dezelfde Stripe-klant hergebruikt i.p.v.
 * er telkens een nieuwe aan te maken. Sessie-gebonden: de leverancier doet
 * dit altijd voor zichzelf, nooit een admin namens iemand anders.
 */
export async function setSupplierStripeCustomerId(supplierId: string, stripeCustomerId: string): Promise<void> {
  const supabase = await sb();
  await supabase.from("suppliers").update({ stripe_customer_id: stripeCustomerId }).eq("id", supplierId);
}

/** Voor de Stripe-webhook: leverancier opzoeken aan de hand van zijn Stripe-klant-id — geen sessie beschikbaar in een inkomend webhook-request, dus service-role. */
export async function getSupplierAccountByStripeCustomerId(stripeCustomerId: string): Promise<SupplierAccount | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("suppliers").select("*").eq("stripe_customer_id", stripeCustomerId).maybeSingle();
  return data ? rowToSupplierAccount(data) : null;
}

/**
 * Zelfbedienings-aanvraag voor een hoger abonnement (livegang-audit
 * augustus 2026, zie migratie 0040) — vervangt de "Work in progress"-
 * doodlopende knop in SubscriptionTierPicker.tsx totdat er een echte
 * betaalflow is. Geeft `null` bij een al bestaande openstaande aanvraag
 * (aanroeper checkt dit vooraf via getPendingTierUpgradeRequest) of bij een
 * databasefout.
 */
export async function requestSupplierTierUpgrade(supplierId: string, tier: SubscriptionTier): Promise<SupplierTierUpgradeRequest | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("supplier_tier_upgrade_requests")
    .insert({ supplier_id: supplierId, requested_tier: tier })
    .select()
    .single();
  if (error || !data) return null;
  return rowToTierUpgradeRequest(data);
}

/** De meest recente NOG OPENSTAANDE aanvraag van deze leverancier, of `null`. Voor de knop-status in SubscriptionTierPicker.tsx. */
export async function getPendingTierUpgradeRequest(supplierId: string): Promise<SupplierTierUpgradeRequest | null> {
  const supabase = await sb();
  const { data } = await supabase
    .from("supplier_tier_upgrade_requests")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToTierUpgradeRequest(data) : null;
}

/** Admin-only: alle openstaande upgrade-aanvragen, met bedrijfsnaam erbij voor de admin-lijst. Vereist service-role. */
export async function listPendingTierUpgradeRequests(): Promise<(SupplierTierUpgradeRequest & { companyName: string; currentTier: SubscriptionTier })[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase
    .from("supplier_tier_upgrade_requests")
    .select("*, supplier:suppliers(company_name, subscription_tier)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data ?? [])
    .filter((r: Row) => r.supplier)
    .map((r: Row) => ({
      ...rowToTierUpgradeRequest(r),
      companyName: r.supplier.company_name,
      currentTier: r.supplier.subscription_tier,
    }));
}

/**
 * Admin-only: keurt een upgrade-aanvraag goed of af. Bij goedkeuring wordt
 * het abonnement METEEN daadwerkelijk omgezet (i.p.v. dat de leverancier
 * daarna nog los zelf iets moet doen) en krijgt de leverancier een melding.
 * Gebruikt overal de service-role-client — de aanroeper is Cem's eigen
 * admin-sessie, niet de sessie van de leverancier zelf, dus `sb()` zou hier
 * (net als bij pushNotification, zie de bugfix hierboven) stuklopen op de
 * eigenaar-only RLS-policies van `suppliers`/`supplier_tier_upgrade_requests`.
 * Vereist service-role.
 */
export async function resolveTierUpgradeRequest(
  requestId: string,
  status: "approved" | "declined",
  adminResponse: string | null
): Promise<SupplierTierUpgradeRequest | null> {
  const admin = createSupabaseAdminClient();
  const supabase = admin ?? (await sb());
  const { data, error } = await supabase
    .from("supplier_tier_upgrade_requests")
    .update({ status, admin_response: adminResponse, resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .select()
    .single();
  if (error || !data) return null;
  const request = rowToTierUpgradeRequest(data);

  const { data: supplierRow } = await supabase.from("suppliers").select("id, owner_id, company_name").eq("id", request.supplierId).maybeSingle();
  if (!supplierRow) return request;

  if (status === "approved") {
    await supabase.from("suppliers").update({ subscription_tier: request.requestedTier }).eq("id", request.supplierId);
  }

  const tierLabel = getEffectiveTierDefinition(request.requestedTier as EffectiveSupplierTier).label;
  await pushNotification({
    userId: supplierRow.owner_id,
    eventId: null,
    type: status === "approved" ? "tier_upgrade_approved" : "tier_upgrade_declined",
    title: status === "approved" ? `Upgrade naar ${tierLabel} goedgekeurd` : "Upgrade-aanvraag afgewezen",
    body:
      status === "approved"
        ? `Je abonnement is omgezet naar ${tierLabel}. De bijbehorende functies zijn meteen actief.`
        : adminResponse || "Neem contact op voor meer informatie over je aanvraag.",
    href: "/supplier/profile",
  });

  return request;
}

/**
 * "Opgeslagen sjablonen voor offertes/berichten" (livegang-audit) —
 * leveranciers typen vaak dezelfde soort tekst opnieuw uit (een vaste
 * pakketomschrijving, een standaard welkomstbericht). Deze drie functies
 * horen bij TemplatePicker.tsx, gebruikt in zowel SupplierOfferForm.tsx
 * (kind="offer") als MessageComposer.tsx (kind="message",
 * leverancierskant). Alle drie draaien onder de sessie van de leverancier
 * zelf (`sb()`) — de RLS-policies in migratie 0042 staan select/insert/
 * delete toe voor de eigenaar van de bijbehorende `suppliers`-rij, dus geen
 * service-role-omweg nodig zoals bij pushNotification.
 */
export async function listSupplierTemplates(supplierId: string, kind: SupplierTemplateKind): Promise<SupplierTemplate[]> {
  const supabase = await sb();
  const { data } = await supabase
    .from("supplier_templates")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("kind", kind)
    .order("created_at", { ascending: false });
  return (data ?? []).map(rowToSupplierTemplate);
}

export async function createSupplierTemplate(supplierId: string, kind: SupplierTemplateKind, title: string, body: string): Promise<SupplierTemplate | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("supplier_templates")
    .insert({ supplier_id: supplierId, kind, title, body })
    .select()
    .single();
  if (error || !data) return null;
  return rowToSupplierTemplate(data);
}

/** Geeft `true` alleen als er ook echt een rij verwijderd is — RLS zorgt er sowieso al voor dat dit nooit andermans sjabloon kan zijn (de `supplier_id`-check hieronder is een extra, expliciete bodem). */
export async function deleteSupplierTemplate(templateId: string, supplierId: string): Promise<boolean> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("supplier_templates")
    .delete()
    .eq("id", templateId)
    .eq("supplier_id", supplierId)
    .select("id");
  return !error && (data?.length ?? 0) > 0;
}

/**
 * "Zelfbedienings AVG-export/verwijderen" (livegang-audit) — een gebruiker
 * dient hiermee zelf een verwijderingsverzoek in; Cem keurt het goed/af op
 * /admin (zie resolveAccountDeletionRequest hieronder), net als bij een
 * abonnementsupgrade-aanvraag. Geeft `null` terug bij een al bestaand
 * openstaand verzoek van dezelfde gebruiker (voorkomt dubbele aanvragen) of
 * een databasefout.
 */
export async function requestAccountDeletion(userId: string, reason: string | null): Promise<AccountDeletionRequest | null> {
  const supabase = await sb();
  const { data: existing } = await supabase
    .from("account_deletion_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return null;

  const { data, error } = await supabase
    .from("account_deletion_requests")
    .insert({ user_id: userId, reason })
    .select()
    .single();
  if (error || !data) return null;
  return rowToAccountDeletionRequest(data);
}

/** De meest recente NOG OPENSTAANDE verwijderingsaanvraag van deze gebruiker, of `null`. Voor de knop-status in de "Privacy & gegevens"-sectie. */
export async function getPendingAccountDeletionRequest(userId: string): Promise<AccountDeletionRequest | null> {
  const supabase = await sb();
  const { data } = await supabase
    .from("account_deletion_requests")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToAccountDeletionRequest(data) : null;
}

/**
 * Admin-only: alle openstaande verwijderingsverzoeken, met e-mailadres
 * erbij voor de admin-lijst. Geen PostgREST-embed (`user:profiles(email)`)
 * gebruikt — `account_deletion_requests.user_id` wijst naar `auth.users`,
 * niet naar `profiles`, dus een automatische foreign-key-embed zou hier
 * niet werken. Een simpele losse tweede query is duidelijker dan daar
 * omheen te bouwen. Vereist service-role.
 */
export async function listPendingAccountDeletionRequests(): Promise<(AccountDeletionRequest & { email: string })[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase
    .from("account_deletion_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  const requests = (data ?? []).map(rowToAccountDeletionRequest);
  if (requests.length === 0) return [];

  const { data: profileRows } = await supabase.from("profiles").select("id, email").in("id", requests.map((r) => r.userId));
  const emailByUserId = new Map((profileRows ?? []).map((p: Row) => [p.id, p.email as string]));
  return requests.filter((r) => emailByUserId.has(r.userId)).map((r) => ({ ...r, email: emailByUserId.get(r.userId)! }));
}

/**
 * Admin-only: keurt een verwijderingsverzoek goed of af. Keurt Cem 'm goed,
 * dan is de daadwerkelijke verwijdering (account + gekoppelde data) op dit
 * moment NOG een handmatige vervolgstap voor Cem zelf in het Supabase-
 * dashboard — bewust geen automatische cascade-delete vanuit de app, want
 * een verkeerd geklikte goedkeuring zou anders onomkeerbaar zijn zonder een
 * laatste, aparte bevestiging buiten deze flow om. Vereist service-role.
 */
export async function resolveAccountDeletionRequest(
  requestId: string,
  status: "approved" | "declined",
  adminResponse: string | null
): Promise<AccountDeletionRequest | null> {
  const admin = createSupabaseAdminClient();
  const supabase = admin ?? (await sb());
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .update({ status, admin_response: adminResponse, resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .select()
    .single();
  if (error || !data) return null;
  return rowToAccountDeletionRequest(data);
}

/**
 * "Winkel open/gesloten" (spec-item #55) — een leverancier zet zichzelf
 * tijdelijk onvindbaar (vakantie, te druk, etc.) zonder per se elke datum
 * apart te hoeven blokkeren. Filtert de leverancier uit zowel de publieke
 * zoekresultaten (`searchSupplierAccounts`) als de AI-matchingpool
 * (`findRealMatchingSuppliers`) zolang `storeOpen` false is.
 */
export async function setSupplierStoreOpen(supplierId: string, open: boolean): Promise<void> {
  const supabase = await sb();
  await supabase.from("suppliers").update({ store_open: open }).eq("id", supplierId);
}

/**
 * Welke van deze kandidaat-leveranciers zijn NIET beschikbaar op `date`? Dat
 * is de vereniging van (a) zelf-geblokkeerde eenmalige datums
 * (`supplier_blocked_dates`), (b) structureel geblokkeerde weekdagen
 * (`supplier_recurring_blocks`, spec-item #128 — anders zou "terugkerende
 * beschikbaarheid" alleen cosmetisch op de kalender staan, zonder de
 * leverancier écht te beschermen tegen een match op die dag), en (c)
 * leveranciers die op die datum al een BEVESTIGDE boeking hebben
 * (`offers.status === "accepted"` voor een event met diezelfde datum) — een
 * leverancier die al ergens anders geboekt is, kan een nieuwe aanvraag voor
 * dezelfde dag toch niet uitvoeren. Bewust losse, simpele queries + een
 * JS-filter op `event.date` (i.p.v. een PostgREST-embedded-filter) — zelfde
 * patroon als elders in dit bestand (zie `getSupplierOrders`), en de
 * kandidaatpool hier is altijd klein genoeg (een paar tientallen) om dat
 * probleemloos te doen.
 */
async function getUnavailableSupplierIds(supplierIds: string[], date: string): Promise<Set<string>> {
  if (supplierIds.length === 0) return new Set();
  const supabase = await sb();
  // UTC-dag-berekening (zelfde reden als blockSupplierDateRange hierboven):
  // voorkomt dat de weekdag rond een tijdzone-/zomertijdgrens verschuift.
  // JS' getUTCDay() geeft 0=zondag..6=zaterdag; (+6)%7 zet dat om naar
  // dezelfde 0=maandag..6=zondag-conventie als supplier_recurring_blocks.weekday.
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const [blockedRes, bookedRes, recurringRes] = await Promise.all([
    supabase.from("supplier_blocked_dates").select("supplier_id").eq("date", date).in("supplier_id", supplierIds),
    supabase.from("offers").select("supplier_id, event:events(date)").eq("status", "accepted").in("supplier_id", supplierIds),
    supabase.from("supplier_recurring_blocks").select("supplier_id").eq("weekday", weekday).in("supplier_id", supplierIds),
  ]);
  const unavailable = new Set<string>((blockedRes.data ?? []).map((r: Row) => r.supplier_id as string));
  for (const row of (recurringRes.data ?? []) as Row[]) unavailable.add(row.supplier_id as string);
  for (const row of (bookedRes.data ?? []) as Row[]) {
    if (row.event?.date === date) unavailable.add(row.supplier_id as string);
  }
  return unavailable;
}

/**
 * Real (DB-backed) suppliers die matchen op categorie, náást de statische
 * demo-catalogus. `eventDate` (indien bekend — veel evenementen hebben pas
 * een `monthHint` i.p.v. een vaste datum) laat beschikbaarheid meetellen:
 * leveranciers die die dag al bevestigd of zelf-geblokkeerd niet beschikbaar
 * zijn worden zwaar teruggezet in de ranking i.p.v. hard uitgesloten — bij
 * een kleine leveranciers-pool is een organisator beter geholpen met een
 * kandidaat die (nog) niet zeker is dan met helemaal niemand.
 */
async function findRealMatchingSuppliers(
  categoryKey: SupplierCategory,
  opts: { locationLabel?: string | null; limit?: number; eventDate?: string | null }
) {
  const supabase = await sb();
  const limit = opts.limit ?? 2;
  // Ruimere kandidaatpool dan het uiteindelijke aantal — anders zou een
  // hard beschikbaarheidsfilter bij een kleine categorie soms niks
  // overhouden om uit te kiezen.
  // Ook hier geldt: "gesloten" (spec-item #55) betekent niet gevonden kunnen
  // worden — dus uitgesloten van de kandidatenpool, niet slechts teruggezet
  // zoals bij een losse geblokkeerde datum hieronder.
  const { data } = await supabase
    .from("suppliers")
    .select("*")
    .eq("store_open", true)
    .contains("categories", [categoryKey])
    .limit(Math.max(limit * 4, 10));
  const pool = (data ?? []).map(rowToSupplierAccount);

  const unavailableIds = opts.eventDate ? await getUnavailableSupplierIds(pool.map((s) => s.id), opts.eventDate) : new Set<string>();

  // Abonnementsniveau-perk (spec-item #53-vervolg, SaaS-pivot): een
  // additieve matching-boost per niveau (Groei/Pro/Premium, en de
  // proefperiode zelf) plus, voor Premium, een HARDE
  // sorteer-override — "gegarandeerd bovenaan" moet dat ook letterlijk zijn,
  // niet slechts een kans, anders klopt de tekst in de voorwaarden niet met
  // wat er werkelijk gebeurt.
  const scored = await Promise.all(
    pool.map(async (sup) => {
      let score = 60;
      if (opts.locationLabel && sup.serviceAreas.some((a) => a.toLowerCase().includes(opts.locationLabel!.toLowerCase()))) {
        score += 20;
      }
      score += Math.round(sup.ratingAvg * 4);
      if (sup.verified) score += 5;
      const priorBookings = await countAcceptedOffersForSupplier(sup.id);
      const tierDefinition = getEffectiveTierDefinition(computeEffectiveTier(sup, priorBookings));
      score += tierDefinition.matchingBoost;
      const unavailableOnDate = unavailableIds.has(sup.id);
      return { supplier: sup, score: Math.min(99, score), unavailableOnDate, guaranteedTopPosition: tierDefinition.guaranteedTopPosition };
    })
  );
  scored.sort((a, b) => {
    if (a.unavailableOnDate !== b.unavailableOnDate) return a.unavailableOnDate ? 1 : -1;
    if (a.guaranteedTopPosition !== b.guaranteedTopPosition) return a.guaranteedTopPosition ? -1 : 1;
    return b.score - a.score;
  });
  return scored.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* LEVERANCIER — AANVRAGEN-INBOX & OFFERTE INDIENEN                    */
/* ------------------------------------------------------------------ */

export async function getSupplierLeads(supplierId: string): Promise<SupplierLead[]> {
  const supabase = await sb();
  const { data } = await supabase
    .from("request_targets")
    .select("*, request:requests(*, event:events(*))")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });
  return (data ?? [])
    .filter((r: Row) => r.request && r.request.event)
    .map((r: Row) => ({
      target: rowToRequestTarget(r),
      request: rowToRequest(r.request),
      event: rowToEvent(r.request.event),
    }));
}

export async function getSupplierLead(supplierId: string, requestId: string): Promise<SupplierLead | null> {
  const leads = await getSupplierLeads(supplierId);
  return leads.find((l) => l.request.id === requestId) ?? null;
}

export async function getSupplierOfferForRequest(supplierId: string, requestId: string): Promise<OfferOption | null> {
  const supabase = await sb();
  const { data } = await supabase.from("offers").select("*").eq("request_id", requestId).eq("supplier_id", supplierId).maybeSingle();
  return data ? rowToOffer(data) : null;
}

export async function submitSupplierOffer(params: {
  supplierId: string;
  requestId: string;
  eventId: string;
  categoryKey: SupplierCategory;
  totalPriceCents: number;
  includes: string[];
  excludes: string[];
  staffIncluded: boolean;
  deliveryIncluded: boolean;
  setupIncluded: boolean;
  remarks: string | null;
}): Promise<OfferOption> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("offers")
    .insert({
      request_id: params.requestId,
      event_id: params.eventId,
      supplier_id: params.supplierId,
      category_key: params.categoryKey,
      status: "available",
      total_price_cents: params.totalPriceCents,
      price_per_person_cents: null,
      includes: params.includes,
      excludes: params.excludes,
      extra_costs_note: null,
      staff_included: params.staffIncluded,
      delivery_included: params.deliveryIncluded,
      setup_included: params.setupIncluded,
      teardown_included: false,
      travel_costs_cents: null,
      cancellation_policy: "Kosteloos annuleren tot 30 dagen vooraf, daarna 50% van het totaalbedrag verschuldigd.",
      payment_terms: "50% aanbetaling bij boeking, restant 14 dagen voor het evenement.",
      valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      remarks: params.remarks,
      match_score: 70,
      match_rationale: "Rechtstreeks ingediend door de leverancier.",
      swipe_decision: "none",
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Kon offerte niet indienen");

  await supabase
    .from("request_targets")
    .update({ status: "responded" })
    .eq("request_id", params.requestId)
    .eq("supplier_id", params.supplierId);

  // Organisator een seintje geven — anders blijft een reactie van een
  // écht (niet-gesimuleerd) leveranciersaccount onopgemerkt.
  const [event, supplier] = await Promise.all([getEvent(params.eventId), getSupplierAccount(params.supplierId)]);
  if (event) {
    await pushNotification({
      userId: event.ownerId,
      eventId: event.id,
      type: "supplier_responded",
      title: "Nieuwe offerte ontvangen",
      body: `${supplier?.companyName ?? "Een leverancier"} heeft gereageerd op je aanvraag.`,
      href: `/events/${event.id}/offers/${params.categoryKey}`,
    });
  }

  return rowToOffer(data);
}

/* ------------------------------------------------------------------ */
/* LEVERANCIER — ORDERS & VERDIENSTEN                                  */
/* ------------------------------------------------------------------ */

export async function getSupplierOrders(supplierId: string): Promise<SupplierOrder[]> {
  const supabase = await sb();
  const { data: offerRows } = await supabase
    .from("offers")
    .select("*, event:events(*)")
    .eq("supplier_id", supplierId)
    .eq("status", "accepted")
    .order("responded_at", { ascending: false });
  const offers = offerRows ?? [];
  if (offers.length === 0) return [];

  const offerIds = offers.map((o: Row) => o.id);
  const { data: paymentRows } = await supabase.from("payments").select("*").in("offer_id", offerIds);
  const paymentByOffer = new Map((paymentRows ?? []).map((p: Row) => [p.offer_id, rowToPayment(p)]));

  return offers.map((o: Row) => ({
    offer: rowToOffer(o),
    event: o.event ? rowToEvent(o.event) : null,
    payment: paymentByOffer.get(o.id) ?? null,
  }));
}

export async function getSupplierEarningsSummary(supplierId: string): Promise<SupplierEarningsSummary> {
  const [orders, leads] = await Promise.all([getSupplierOrders(supplierId), getSupplierLeads(supplierId)]);
  // totalCents (het volledige, afgesproken bedrag), niet supplierAmountCents
  // (het deel ná aftrek van Vyra's commissie) — zolang Vyra zelf geen
  // betalingen verwerkt, betaalt de organisator rechtstreeks aan de
  // leverancier, zonder dat Vyra daar iets van inhoudt. Zie de toelichting
  // op de checkout-pagina (app/events/[id]/checkout/[paymentId]/page.tsx).
  const paidCents = orders.filter((o) => o.payment?.status === "paid").reduce((sum, o) => sum + (o.payment?.totalCents ?? 0), 0);
  const pendingCents = orders.filter((o) => o.payment && o.payment.status !== "paid").reduce((sum, o) => sum + (o.payment?.totalCents ?? 0), 0);
  const now = new Date();
  const upcomingThisMonthCount = orders.filter((o) => {
    if (!o.event?.date) return false;
    const d = new Date(o.event.date);
    return d >= now && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  return {
    paidCents,
    pendingCents,
    openLeadsCount: leads.filter((l) => l.target.status === "pending").length,
    activeOrdersCount: orders.length,
    upcomingThisMonthCount,
  };
}

/**
 * Cem (aug. 2026): "maak analytics pagina zodat leveranciers kunnen zien
 * hoe en wat" — reactietijd en beoordeling staan al écht bij (avg_response_
 * hours wordt dagelijks herberekend via api/cron/recompute-response-times,
 * rating_avg/rating_count bij elke nieuwe review, zie hieronder). Wat
 * ontbrak was een categoriegemiddelde om jezelf tegen af te zetten — dat is
 * hier één extra, simpele query op dezelfde tabel.
 *
 * `accepted_offer_rate` wordt sinds api/cron/recompute-acceptance-rate ook
 * écht herberekend (was eerder bewust weggelaten omdat het voor elke
 * echte leverancier altijd "0%" liet zien) — `offersSubmittedCount` geeft
 * de aanroeper de mogelijkheid om "0% acceptatie" te onderscheiden van
 * "nog geen offertes ingediend".
 */
export async function getSupplierPerformanceInsights(supplierId: string): Promise<SupplierPerformanceInsights> {
  const supabase = await sb();
  const { data: own } = await supabase
    .from("suppliers")
    .select("avg_response_hours, rating_avg, rating_count, avg_price_cents, category, accepted_offer_rate, offers_submitted_count")
    .eq("id", supplierId)
    .single();

  if (!own) {
    return {
      avgResponseHours: 24,
      ratingAvg: 0,
      ratingCount: 0,
      categoryAvgResponseHours: null,
      categoryAvgRating: null,
      categoryPeerCount: 0,
      avgPriceCents: 0,
      categoryAvgPriceCents: null,
      acceptedOfferRate: 0,
      offersSubmittedCount: 0,
      categoryAvgAcceptedOfferRate: null,
    };
  }

  const { data: peers } = await supabase
    .from("suppliers")
    .select("avg_response_hours, rating_avg, rating_count, avg_price_cents, accepted_offer_rate, offers_submitted_count")
    .eq("category", own.category)
    .neq("id", supplierId);

  const peerRows = peers ?? [];
  const peersWithRatings = peerRows.filter((p: Row) => (p.rating_count ?? 0) > 0);
  const peersWithPricing = peerRows.filter((p: Row) => (p.avg_price_cents ?? 0) > 0);
  // Alleen leveranciers die ooit een offerte hebben ingediend tellen mee —
  // anders trekt iedere gloednieuwe leverancier (accepted_offer_rate blijft
  // op de default 0 staan) het categoriegemiddelde onterecht omlaag, net
  // zoals hierboven al bij categoryAvgPriceCents.
  const peersWithOffers = peerRows.filter((p: Row) => (p.offers_submitted_count ?? 0) > 0);

  return {
    avgResponseHours: own.avg_response_hours ?? 24,
    ratingAvg: Number(own.rating_avg ?? 0),
    ratingCount: own.rating_count ?? 0,
    categoryAvgResponseHours:
      peerRows.length > 0 ? peerRows.reduce((sum: number, p: Row) => sum + (p.avg_response_hours ?? 24), 0) / peerRows.length : null,
    categoryAvgRating:
      peersWithRatings.length > 0
        ? peersWithRatings.reduce((sum: number, p: Row) => sum + Number(p.rating_avg ?? 0), 0) / peersWithRatings.length
        : null,
    categoryPeerCount: peerRows.length,
    avgPriceCents: own.avg_price_cents ?? 0,
    // Alleen leveranciers met een daadwerkelijk ingevulde gemiddelde prijs
    // (>0) tellen mee — anders trekt een lege/0-prijs (bv. een net
    // aangemaakt profiel) het categoriegemiddelde onterecht omlaag.
    categoryAvgPriceCents:
      peersWithPricing.length > 0 ? peersWithPricing.reduce((sum: number, p: Row) => sum + (p.avg_price_cents ?? 0), 0) / peersWithPricing.length : null,
    acceptedOfferRate: Number(own.accepted_offer_rate ?? 0),
    offersSubmittedCount: own.offers_submitted_count ?? 0,
    categoryAvgAcceptedOfferRate:
      peersWithOffers.length > 0
        ? peersWithOffers.reduce((sum: number, p: Row) => sum + Number(p.accepted_offer_rate ?? 0), 0) / peersWithOffers.length
        : null,
  };
}

/* ------------------------------------------------------------------ */
/* REQUESTS & OFFERS                                                   */
/* ------------------------------------------------------------------ */

export async function getRequestsForEvent(eventId: string): Promise<ServiceRequest[]> {
  const supabase = await sb();
  const { data } = await supabase.from("requests").select("*").eq("event_id", eventId);
  return (data ?? []).map(rowToRequest);
}

export async function getRequest(requestId: string): Promise<ServiceRequest | null> {
  const supabase = await sb();
  const { data } = await supabase.from("requests").select("*").eq("id", requestId).single();
  return data ? rowToRequest(data) : null;
}

function buildMatchRationale(supplier: { ratingAvg: number; acceptedOfferRate: number; verified: boolean }, score: number, location: string | null) {
  const bits: string[] = [];
  if (location) bits.push(`actief in ${location}`);
  if (supplier.ratingAvg >= 4.7) bits.push("uitstekende beoordelingen");
  if (supplier.acceptedOfferRate >= 0.4) bits.push("hoge acceptatiegraad bij vergelijkbare evenementen");
  if (supplier.verified) bits.push("geverifieerde leverancier");
  const reason = bits.length ? bits.join(", ") : "past qua profiel bij dit evenement";
  return `Sterke match (${score}%) omdat deze leverancier ${reason}.`;
}

function defaultIncludes(cat: SupplierCategory): string[] {
  const map: Partial<Record<SupplierCategory, string[]>> = {
    catering: ["Volledig menu", "Bediening", "Servies & bestek"],
    photography: ["6 uur aanwezigheid", "Digitale foto's in hoge resolutie", "Online galerij"],
    videography: ["Ceremonie + speeches", "Highlight-film van 4-6 min"],
    dj_music: ["DJ 5 uur", "Geluidsinstallatie", "Basis lichtshow"],
    florist: ["Bruidsboeket", "Tafelstukken", "Ceremonieboog"],
    venue: ["Exclusief gebruik locatie", "Tafels & stoelen basis", "Parkeerfaciliteiten"],
    furniture_rental: ["Levering en ophalen", "Op- en afbouw"],
    cake: ["Taart op maat", "Proeverij vooraf"],
    cleaning: ["Eindschoonmaak", "Afvalverwerking"],
    planner: ["Dagcoördinatie", "Contactpersoon voor leveranciers"],
  };
  return map[cat] ?? ["Basisdienstverlening zoals aangevraagd"];
}
function defaultExcludes(cat: SupplierCategory): string[] {
  const map: Partial<Record<SupplierCategory, string[]>> = {
    catering: ["Drankarrangement", "Extra personeel na 24:00"],
    photography: ["Fotoalbum (optioneel bij te boeken)", "Extra fotograaf"],
    videography: ["Drone-opnames"],
    dj_music: ["Extra uren boven 5 uur", "Speciale effecten (CO2, confetti)"],
    florist: ["Decoratie buiten bloemwerk"],
    venue: ["Catering", "Decoratie"],
  };
  return map[cat] ?? [];
}

export async function createAndSendRequest(params: {
  eventId: string;
  categoryKey: SupplierCategory;
  desiredService: string;
  specialRequests: string;
  budgetCents: number | null;
  locationLabel?: string | null;
  /** De evenementdatum, indien al bekend — laat leveranciersbeschikbaarheid meetellen bij het matchen van échte accounts (zie `findRealMatchingSuppliers`). */
  eventDate?: string | null;
}): Promise<{ request: ServiceRequest; offers: OfferOption[] }> {
  const supabase = await sb();
  const matches = findMatchingSuppliers(params.categoryKey, { locationLabel: params.locationLabel, limit: 4 });
  const sentAt = new Date();
  const deadline = new Date(sentAt.getTime() + SUPPLIER_RESPONSE_WINDOW_HOURS * 60 * 60 * 1000);

  const { data: requestRow, error: requestError } = await supabase
    .from("requests")
    .insert({
      event_id: params.eventId,
      category_key: params.categoryKey,
      supplier_ids: matches.map((m) => m.supplier.id),
      desired_service: params.desiredService,
      special_requests: params.specialRequests,
      budget_cents: params.budgetCents,
      status: "awaiting_response",
      sent_at: sentAt.toISOString(),
      deadline_at: deadline.toISOString(),
    })
    .select()
    .single();
  if (requestError || !requestRow) throw new Error(requestError?.message ?? "Kon aanvraag niet versturen");
  const request = rowToRequest(requestRow);

  // Naast de gesimuleerde demo-catalogus matchen we ook échte, geregistreerde
  // leveranciers in deze categorie. Zij krijgen geen automatisch gesimuleerde
  // offerte — zij zien de aanvraag in hun eigen dashboard en dienen zelf een
  // offerte in.
  const realMatches = await findRealMatchingSuppliers(params.categoryKey, {
    locationLabel: params.locationLabel,
    limit: 2,
    eventDate: params.eventDate,
  });
  if (realMatches.length > 0) {
    await supabase.from("request_targets").insert(
      realMatches.map(({ supplier }) => ({ request_id: request.id, supplier_id: supplier.id, status: "pending" }))
    );

    // Tot nu toe kreeg een écht (niet-gesimuleerd) leveranciersaccount
    // helemaal geen seintje dat er een nieuwe aanvraag in hun inbox lag —
    // niet in-app, niet per e-mail. Zonder dit moet een leverancier zelf
    // regelmatig /supplier/requests blijven controleren.
    await Promise.all(
      realMatches.map(({ supplier }) =>
        pushNotification({
          userId: supplier.ownerId,
          eventId: params.eventId,
          type: "new_request",
          title: "Nieuwe aanvraag",
          body: `Een organisator zoekt ${SUPPLIER_CATEGORY_LABELS[params.categoryKey].toLowerCase()} voor hun evenement.`,
          href: `/supplier/requests/${request.id}`,
        })
      )
    );
  }

  // Demo-modus: we simuleren dat leveranciers (met wisselende snelheid)
  // binnen de 48-uursvenster reageren, zodat de kernflow direct te
  // ervaren is. In productie komt dit binnen via het supplier-portaal.
  const offerInserts = matches
    .filter(() => Math.random() < 0.85)
    .map(({ supplier, score }) => {
      const priceVariance = 0.85 + Math.random() * 0.35;
      const total = Math.round(supplier.avgPriceCents * priceVariance);
      return {
        request_id: request.id,
        event_id: params.eventId,
        supplier_id: supplier.id,
        category_key: params.categoryKey,
        status: "available",
        total_price_cents: total,
        price_per_person_cents: null,
        includes: defaultIncludes(params.categoryKey),
        excludes: defaultExcludes(params.categoryKey),
        extra_costs_note: Math.random() > 0.6 ? "Reiskosten buiten 25km: €0,45/km" : null,
        staff_included: Math.random() > 0.4,
        delivery_included: Math.random() > 0.3,
        setup_included: Math.random() > 0.3,
        teardown_included: Math.random() > 0.5,
        travel_costs_cents: Math.random() > 0.7 ? 7500 : null,
        cancellation_policy: "Kosteloos annuleren tot 60 dagen vooraf, daarna 50% van het totaalbedrag verschuldigd.",
        payment_terms: "50% aanbetaling bij boeking, restant 14 dagen voor het evenement.",
        valid_until: new Date(sentAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        remarks: null,
        match_score: score,
        match_rationale: buildMatchRationale(supplier, score, params.locationLabel ?? null),
        responded_at: new Date(sentAt.getTime() + Math.random() * 40 * 60 * 60 * 1000).toISOString(),
        swipe_decision: "none",
      };
    });

  let offers: OfferOption[] = [];
  if (offerInserts.length > 0) {
    const { data: offerRows } = await supabase.from("offers").insert(offerInserts).select();
    offers = (offerRows ?? []).map(rowToOffer);
    await supabase.from("requests").update({ status: "responded" }).eq("id", request.id);
    request.status = "responded";
  }

  return { request, offers };
}

/**
 * Maatwerkaanvraag: de organisator stuurt een aanvraag rechtstreeks naar
 * één specifieke (échte) leverancier, in plaats van de automatische
 * matching over meerdere leveranciers. Er worden geen demo-offertes
 * gesimuleerd — de leverancier ziet 'm gewoon als aanvraag in zijn eigen
 * inbox (net als de door AI gematchte aanvragen) en dient er zelf op.
 */
export async function sendCustomSupplierRequest(params: {
  eventId: string;
  supplierId: string;
  categoryKey: SupplierCategory;
  desiredService: string;
  specialRequests: string;
  budgetCents: number | null;
}): Promise<ServiceRequest | null> {
  const supabase = await sb();
  const sentAt = new Date();
  const deadline = new Date(sentAt.getTime() + SUPPLIER_RESPONSE_WINDOW_HOURS * 60 * 60 * 1000);

  const { data: requestRow, error } = await supabase
    .from("requests")
    .insert({
      event_id: params.eventId,
      category_key: params.categoryKey,
      supplier_ids: [],
      desired_service: params.desiredService,
      special_requests: params.specialRequests,
      budget_cents: params.budgetCents,
      status: "awaiting_response",
      sent_at: sentAt.toISOString(),
      deadline_at: deadline.toISOString(),
      target_supplier_id: params.supplierId,
      is_direct: true,
    })
    .select()
    .single();
  if (error || !requestRow) return null;
  const request = rowToRequest(requestRow);

  await supabase.from("request_targets").insert({ request_id: request.id, supplier_id: params.supplierId, status: "pending" });

  const supplier = await getSupplierAccount(params.supplierId);
  if (supplier) {
    await pushNotification({
      userId: supplier.ownerId,
      eventId: params.eventId,
      type: "new_request",
      title: "Nieuwe maatwerkaanvraag",
      body: `Een organisator heeft rechtstreeks een aanvraag voor ${SUPPLIER_CATEGORY_LABELS[params.categoryKey].toLowerCase()} naar je gestuurd.`,
      href: `/supplier/requests/${request.id}`,
    });
  }

  return request;
}

export async function getOffersForEvent(eventId: string, categoryKey?: SupplierCategory): Promise<OfferOption[]> {
  const supabase = await sb();
  let query = supabase.from("offers").select("*").eq("event_id", eventId);
  if (categoryKey) query = query.eq("category_key", categoryKey);
  const { data } = await query;
  return (data ?? []).map(rowToOffer);
}

export async function getOffer(offerId: string): Promise<OfferOption | null> {
  const supabase = await sb();
  const { data } = await supabase.from("offers").select("*").eq("id", offerId).single();
  return data ? rowToOffer(data) : null;
}

export async function decideSwipe(offerId: string, decision: "shortlisted" | "rejected" | "none"): Promise<OfferOption | null> {
  const supabase = await sb();
  const current = await getOffer(offerId);
  if (!current) return null;
  const patch: Row = { swipe_decision: decision };
  if (decision === "shortlisted") patch.status = "shortlisted";
  else if (decision === "rejected") patch.status = "declined";
  const { data, error } = await supabase.from("offers").update(patch).eq("id", offerId).select().single();
  if (error || !data) return null;
  return rowToOffer(data);
}

export async function acceptOffer(offerId: string): Promise<OfferOption | null> {
  const supabase = await sb();
  const { data, error } = await supabase.from("offers").update({ status: "accepted", swipe_decision: "shortlisted" }).eq("id", offerId).select().single();
  if (error || !data) return null;
  const offer = rowToOffer(data);
  await updateRequirementStatus(offer.eventId, offer.categoryKey, "confirmed");
  return offer;
}

export async function getShortlistForEvent(eventId: string): Promise<OfferOption[]> {
  const offers = await getOffersForEvent(eventId);
  return offers.filter((o) => o.swipeDecision === "shortlisted" || o.status === "accepted" || o.status === "shortlisted");
}

/* ------------------------------------------------------------------ */
/* REVIEWS (wederzijdse beoordelingen)                                 */
/*                                                                       */
/* Zie supabase/migrations/0033_reviews.sql voor de RLS-policies: de     */
/* "verborgen tot allebei hebben ingevuld (of de deadline verstrijkt)"-  */
/* regel leeft daar in een SECURITY DEFINER-functie (reviews_revealed),  */
/* niet hier in TypeScript — dezelfde tegen-RLS-recursie-aanpak als      */
/* is_event_owner()/is_supplier_targeted_for_event() (migratie 0009).    */
/* Deze functies gebruiken daarom gewoon de sessie-client (`sb()`), net  */
/* als de rest van dit bestand: de database is hier de bron van waarheid */
/* over wat deze gebruiker mag lezen, niet applicatiecode.               */
/* ------------------------------------------------------------------ */

function rowToReview(r: Row): Review {
  return {
    id: r.id,
    offerId: r.offer_id,
    eventId: r.event_id,
    supplierId: r.supplier_id,
    reviewerRole: r.reviewer_role,
    rating: r.rating,
    comment: r.comment ?? null,
    noShow: r.no_show ?? false,
    photoUrls: r.photo_urls ?? [],
    videoUrl: r.video_url ?? null,
    createdAt: r.created_at,
  };
}

/** Beide kanten (0, 1 of 2 rijen — RLS bepaalt wat déze gebruiker op dit moment mag zien) van de beoordeling voor één boeking. */
export async function getReviewsForOffer(offerId: string): Promise<Review[]> {
  const supabase = await sb();
  const { data } = await supabase.from("reviews").select("*").eq("offer_id", offerId);
  return (data ?? []).map(rowToReview);
}

/**
 * Herberekent suppliers.rating_avg/rating_count uit alle organisator-
 * beoordelingen voor deze leverancier — hiermee wordt het sterrencijfer dat
 * al overal op het platform wordt getoond eindelijk een écht, ingevuld
 * cijfer i.p.v. los sierraad zonder schrijf-flow erachter. Gebruikt bewust
 * de service-role client: bij een organisator-beoordeling is de aanroeper
 * NOOIT de eigenaar van de leverancier ("suppliers: eigenaar wijzigt"
 * zou een gewone sessie hier blokkeren) — zelfde smalle, gedocumenteerde
 * uitzondering als pushNotification() hierboven (het doel-id komt nooit
 * uit gebruikersinvoer, hier: `offer.supplierId`, al legitiem opgehaald
 * via de RLS-beschermde offers-tabel).
 */
async function recomputeSupplierRating(supplierId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data } = await admin.from("reviews").select("rating").eq("supplier_id", supplierId).eq("reviewer_role", "organizer");
  const ratings = (data ?? []).map((r: Row) => r.rating as number);
  const ratingCount = ratings.length;
  const ratingAvg = ratingCount > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratingCount : 0;
  await admin.from("suppliers").update({ rating_avg: ratingAvg, rating_count: ratingCount }).eq("id", supplierId);
}

export interface SubmitReviewInput {
  offerId: string;
  eventId: string;
  supplierId: string;
  reviewerRole: ReviewerRole;
  rating: number;
  comment: string | null;
  noShow: boolean;
  photoUrls: string[];
  videoUrl: string | null;
}

/**
 * Slaat één kant van een beoordeling op. Geeft `null` terug bij een dubbele
 * beoordeling (de unique-constraint op offer_id+reviewer_role), een
 * geweigerde RLS-check, of een opslagfout — de aanroepende actie toont dan
 * een duidelijke melding i.p.v. stilzwijgend te falen.
 */
export async function submitReview(input: SubmitReviewInput): Promise<Review | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      offer_id: input.offerId,
      event_id: input.eventId,
      supplier_id: input.supplierId,
      reviewer_role: input.reviewerRole,
      rating: input.rating,
      comment: input.comment,
      no_show: input.noShow,
      photo_urls: input.photoUrls,
      video_url: input.videoUrl,
    })
    .select()
    .single();
  if (error || !data) return null;
  if (input.reviewerRole === "organizer") await recomputeSupplierRating(input.supplierId);
  return rowToReview(data);
}

/**
 * Openbare, al onthulde organisator-beoordelingen voor het
 * leveranciersprofiel (nieuwste eerst) — precies het gat dat het
 * onderzoeksvoorstel benoemde: een sterrenscore die je ook daadwerkelijk
 * kunt nalezen, niet alleen een los cijfer. Werkt ook voor uitgelogde
 * bezoekers: de RLS-policy "reviews: openbaar zodra onthuld" staat select
 * hiervan toe zonder sessie.
 */
export async function getPublicReviewsForSupplier(supplierId: string, limit = 20): Promise<Review[]> {
  const supabase = await sb();
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("reviewer_role", "organizer")
    .order("created_at", { ascending: false })
    .limit(limit);
  // Geen extra filtering nodig: de RLS-policy hierboven laat sowieso alleen
  // al-onthulde rijen door.
  return (data ?? []).map(rowToReview);
}

/* ------------------------------------------------------------------ */
/* TIMELINE / TASKS / RISKS                                            */
/* ------------------------------------------------------------------ */

export async function getTimeline(eventId: string): Promise<EventTimelineItem[]> {
  const supabase = await sb();
  const { data } = await supabase.from("event_timeline").select("*").eq("event_id", eventId).order("due_date", { ascending: true });
  return (data ?? []).map(rowToTimeline);
}
export async function setTimeline(eventId: string, items: EventTimelineItem[]): Promise<EventTimelineItem[]> {
  const supabase = await sb();
  await supabase.from("event_timeline").delete().eq("event_id", eventId);
  if (items.length === 0) return [];
  const rows = items.map((i) => ({ event_id: eventId, title: i.title, due_date: i.dueDate, lead_time_label: i.leadTimeLabel, category_key: i.categoryKey, done: i.done, source: i.source }));
  const { data } = await supabase.from("event_timeline").insert(rows).select();
  return (data ?? []).map(rowToTimeline);
}
export async function toggleTimelineDone(eventId: string, itemId: string, done: boolean): Promise<EventTimelineItem[]> {
  const supabase = await sb();
  await supabase.from("event_timeline").update({ done }).eq("id", itemId).eq("event_id", eventId);
  return getTimeline(eventId);
}

export async function getTasks(eventId: string): Promise<EventTask[]> {
  const supabase = await sb();
  const { data } = await supabase.from("event_tasks").select("*").eq("event_id", eventId);
  return (data ?? []).map(rowToTask);
}
export async function setTasks(eventId: string, items: EventTask[]): Promise<EventTask[]> {
  const supabase = await sb();
  await supabase.from("event_tasks").delete().eq("event_id", eventId);
  if (items.length === 0) return [];
  const rows = items.map((t) => ({ event_id: eventId, title: t.title, urgency: t.urgency, done: t.done, source: t.source, related_category: t.relatedCategory ?? null }));
  const { data } = await supabase.from("event_tasks").insert(rows).select();
  return (data ?? []).map(rowToTask);
}
export async function toggleTaskDone(eventId: string, taskId: string, done: boolean): Promise<EventTask[]> {
  const supabase = await sb();
  await supabase.from("event_tasks").update({ done }).eq("id", taskId).eq("event_id", eventId);
  return getTasks(eventId);
}

export async function getRisks(eventId: string): Promise<RiskFlag[]> {
  const supabase = await sb();
  const { data } = await supabase.from("event_risks").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  return (data ?? []).map(rowToRisk);
}
export async function setRisks(eventId: string, risks: RiskFlag[]): Promise<RiskFlag[]> {
  const supabase = await sb();
  await supabase.from("event_risks").delete().eq("event_id", eventId);
  if (risks.length === 0) return [];
  const rows = risks.map((r) => ({ event_id: eventId, severity: r.severity, message: r.message }));
  const { data } = await supabase.from("event_risks").insert(rows).select();
  return (data ?? []).map(rowToRisk);
}

/* ------------------------------------------------------------------ */
/* BUDGET & READINESS                                                  */
/* ------------------------------------------------------------------ */

export async function getBudgetSummary(eventId: string): Promise<EventBudgetSummary> {
  const event = await getEvent(eventId);
  const totalCents = event?.budget?.totalCents ?? 0;
  const offers = await getOffersForEvent(eventId);
  const committedCents = offers.filter((o) => o.status === "accepted").reduce((sum, o) => sum + o.totalPriceCents, 0);
  const reqs = await getRequirements(eventId);
  const pendingCents = reqs
    .filter((r) => r.selected && r.status !== "confirmed" && r.status !== "paid" && r.status !== "completed")
    .reduce((sum, r) => sum + (r.estimatedBudgetCents ?? 0), 0);
  const remainingCents = totalCents - committedCents - pendingCents;
  const projected = committedCents + pendingCents;
  const percentOverBudget = totalCents > 0 && projected > totalCents ? Math.round(((projected - totalCents) / totalCents) * 100) : 0;
  return { totalCents, committedCents, pendingCents, remainingCents, percentOverBudget };
}

export async function computeReadiness(eventId: string): Promise<EventReadiness> {
  const reqs = await getRequirements(eventId);
  const selected = reqs.filter((r) => r.selected);
  if (selected.length === 0) return { score: 0, missingEssentials: [], categoryStatus: {} };

  const weight = (r: RequirementPriority) => (r === "essential" ? 3 : r === "recommended" ? 2 : 1);
  let earned = 0;
  let possible = 0;
  const categoryStatus: Record<string, "confirmed" | "in_progress" | "missing"> = {};
  const missingEssentials: SupplierCategory[] = [];

  for (const r of selected) {
    const w = weight(r.priority);
    possible += w;
    if (r.status === "confirmed" || r.status === "paid" || r.status === "completed") {
      earned += w;
      categoryStatus[r.categoryKey] = "confirmed";
    } else if (r.status === "suggested" || r.status === "selected") {
      categoryStatus[r.categoryKey] = "missing";
      if (r.priority === "essential") missingEssentials.push(r.categoryKey);
    } else {
      earned += w * 0.4;
      categoryStatus[r.categoryKey] = "in_progress";
    }
  }
  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  return { score, missingEssentials, categoryStatus };
}

/**
 * Berekent de ÉÉN belangrijkste eerstvolgende actie voor de organisator,
 * in prioriteitsvolgorde: essentiële categorie niet gekozen → aanvraag nog
 * niet verstuurd → betaling nog niet afgerond → leverancier reageert niet op
 * tijd → offertes wachten op een keuze → een urgente taak → (als alles
 * geregeld is) een positieve afsluiting. Dit voedt de "Wat nu?"-kaart
 * bovenaan het event-dashboard, zodat de organisator nooit zelf hoeft uit te
 * zoeken langs welk tabblad de volgende stap zit.
 */
export async function computeNextStep(eventId: string): Promise<NextStep | null> {
  const event = await getEvent(eventId);
  if (!event) return null;
  const base = `/events/${eventId}`;

  const [allRequirements, requests, payments, tasks] = await Promise.all([
    getRequirements(eventId),
    getRequestsForEvent(eventId),
    getPaymentsForEvent(eventId),
    getTasks(eventId),
  ]);
  if (allRequirements.length === 0) return null;

  const unselectedEssential = allRequirements.filter((r) => r.priority === "essential" && !r.selected);
  if (unselectedEssential.length > 0) {
    const n = unselectedEssential.length;
    return {
      title: "Kies je essentiële categorieën",
      description: `Je hebt nog ${n} essentieel onderdeel${n > 1 ? "en" : ""} niet geselecteerd in je plan — zonder deze mist er iets belangrijks.`,
      href: `${base}/plan`,
      ctaLabel: "Naar je plan",
      icon: "sparkles",
      tone: "warning",
    };
  }

  const selectedNotRequested = allRequirements
    .filter((r) => r.selected && r.status === "selected")
    .sort((a, b) => (a.priority === "essential" ? -1 : 1) - (b.priority === "essential" ? -1 : 1));
  if (selectedNotRequested.length > 0) {
    const n = selectedNotRequested.length;
    return {
      title: "Verstuur je aanvragen",
      description: `Je hebt ${n} categorie${n > 1 ? "ën" : ""} gekozen die nog geen aanvraag naar leveranciers heeft gehad. Verstuur ze om offertes te ontvangen.`,
      href: `${base}/requests`,
      ctaLabel: "Aanvragen versturen",
      icon: "send",
      tone: "action",
    };
  }

  // Bij een offerte die in delen wordt betaald (aanbetaling + restbedrag)
  // mag het restbedrag pas als "volgende stap" getoond worden nadat de
  // aanbetaling betaald is — anders zou de organisator hier per ongeluk
  // naar de restbetaling doorgestuurd kunnen worden vóór de aanbetaling.
  const pendingPayment = payments
    .filter((p) => p.status === "pending")
    .filter((p) => {
      if (p.installment !== "balance") return true;
      const deposit = payments.find((s) => s.id === p.parentPaymentId);
      return deposit ? deposit.status === "paid" : true;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
  if (pendingPayment) {
    const req = allRequirements.find((r) => r.categoryKey === pendingPayment.categoryKey);
    return {
      title: "Rond je betaling af",
      description: `Je hebt een leverancier voor ${req?.label ?? SUPPLIER_CATEGORY_LABELS[pendingPayment.categoryKey]} geaccepteerd — de betaling wacht nog op bevestiging.`,
      href: `${base}/checkout/${pendingPayment.id}`,
      ctaLabel: "Naar betaling",
      icon: "wallet",
      tone: "warning",
    };
  }

  const now = new Date();
  const overdueRequest = requests.find((r) => (r.status === "sent" || r.status === "awaiting_response") && new Date(r.deadlineAt) < now);
  if (overdueRequest) {
    return {
      title: "Een leverancier laat op zich wachten",
      description: `De reactietermijn van 48 uur voor ${SUPPLIER_CATEGORY_LABELS[overdueRequest.categoryKey]} is verstreken. Bekijk je aanvraag of vraag een extra leverancier aan.`,
      href: `${base}/requests`,
      ctaLabel: "Bekijk aanvragen",
      icon: "clock",
      tone: "warning",
    };
  }

  const decisionNeeded = allRequirements.find((r) => r.status === "offers_received" || r.status === "shortlisted");
  if (decisionNeeded) {
    return {
      title: "Tijd om te kiezen",
      description: `Je hebt offertes ontvangen voor ${decisionNeeded.label}. Bekijk ze en kies je favoriet.`,
      href: `${base}/offers/${decisionNeeded.categoryKey}`,
      ctaLabel: "Bekijk offertes",
      icon: "inbox",
      tone: "action",
    };
  }

  const urgentTask = tasks.find((t) => !t.done && t.urgency === "urgent");
  if (urgentTask) {
    return {
      title: urgentTask.title,
      description: "Deze taak staat als urgent gemarkeerd en is nog niet afgerond.",
      href: base,
      ctaLabel: "Bekijk taken",
      icon: "clock",
      tone: "warning",
    };
  }

  const selected = allRequirements.filter((r) => r.selected);
  const allDone = selected.length > 0 && selected.every((r) => ["confirmed", "paid", "completed"].includes(r.status));
  if (allDone) {
    return {
      title: "Je zit helemaal op schema",
      description: "Alle geselecteerde onderdelen zijn geregeld. Werp een blik op je planning voor de laatste puntjes op de i.",
      href: `${base}/timeline`,
      ctaLabel: "Bekijk planning",
      icon: "check-circle",
      tone: "success",
    };
  }

  return {
    title: "Werk je plan verder af",
    description: "Er staan nog aanbevolen of optionele onderdelen open die je kunt toevoegen of afronden.",
    href: `${base}/plan`,
    ctaLabel: "Naar je plan",
    icon: "sparkles",
    tone: "action",
  };
}

/* ------------------------------------------------------------------ */
/* PAYMENTS                                                             */
/* ------------------------------------------------------------------ */

/**
 * Maakt de betaling(en) voor een geaccepteerde offerte aan.
 *
 * plan "full" (standaard): één betaalrij voor het volledige bedrag —
 * ongewijzigd gedrag.
 *
 * plan "deposit": twee gekoppelde rijen — een aanbetaling van
 * DEFAULT_DEPOSIT_PERCENT nu, en het restbedrag later (installment
 * "balance", met parent_payment_id naar de aanbetaling). Bedragen worden
 * verhoudingsgewijs gesplitst (leveranciersbedrag, platformfee en totaal
 * apart), met het restbedrag als sluitpost zodat afronding nooit een
 * paar centen laat "verdwijnen".
 *
 * Geeft de rij terug waarmee de organisator als eerste moet afrekenen
 * (bij "deposit" dus de aanbetaling).
 */
export async function createPaymentForOffer(offerId: string, plan: "full" | "deposit" = "full"): Promise<Payment | null> {
  const supabase = await sb();
  const o = await getOffer(offerId);
  if (!o) return null;

  // Voorkomt dubbele betalingen: een dubbele klik op "Accepteren", of een
  // organisator die na accepteren teruggaat (zonder af te rekenen) en
  // opnieuw op "Accepteren" klikt, maakte hiervoor telkens een NIEUWE
  // `payments`-rij aan — als beide later betaald worden, wordt er twee keer
  // afgerekend voor dezelfde boeking. Is er al een niet-mislukte/
  // terugbetaalde betaling voor deze offerte, dan hergebruiken we die.
  const existingPayments = await getPaymentsForOffer(offerId);
  const reusablePayment = existingPayments.find((p) => p.status === "pending" || p.status === "paid");
  if (reusablePayment) return reusablePayment;

  // Voorkomt dubbel boeken binnen dezelfde categorie: als de organisator al
  // een andere offerte in deze categorie heeft geaccepteerd, mag deze
  // offerte niet ook nog geaccepteerd (en betaald) worden — de UI verbergt
  // de knop al zodra een offerte is geaccepteerd (zie OfferBrowser.tsx),
  // maar deze server-side check blijft de laatste, doorslaggevende grens.
  const categorySiblings = await getOffersForEvent(o.eventId, o.categoryKey);
  if (categorySiblings.some((sibling) => sibling.id !== o.id && sibling.status === "accepted")) return null;

  // Livegang-audit (aug. 2026): de check hierboven alleen is NIET genoeg.
  // offer.status wordt pas "accepted" bij BEVESTIGEN (zie markPaymentPaid
  // hieronder) — niet al bij dit "Accepteren"-moment zelf. Zonder onderstaand
  // stuk kon een organisator na "Accepteren" van offerte A (nog niet
  // afgerekend) teruggaan naar de offertes en óók offerte B "Accepteren" —
  // beide offertes hebben dan nog gewoon status "pending", dus de check
  // hierboven ziet niets. Bevestigt de organisator daarna allebei los, dan
  // staan er twee leveranciers geboekt voor dezelfde categorie.
  //
  // Een AL BETAALDE/bevestigde betaling van een andere offerte in deze
  // categorie blokkeert hard — dat is een echte boeking, die overschrijven
  // we nooit stilzwijgend. Een nog NIET bevestigde (pending) betaling van
  // een andere offerte annuleren we automatisch: de organisator koos
  // duidelijk voor een andere leverancier in dezelfde categorie, dus die
  // oude, nooit afgeronde keuze mag vervallen i.p.v. de nieuwe keuze te
  // blokkeren (er is geen "annuleer mijn vorige keuze"-knop elders in de
  // app, dus dit moet hier gebeuren, anders zit een organisator vast).
  const categoryPayments = await getPaymentsForEvent(o.eventId);
  const siblingPayments = categoryPayments.filter((p) => p.categoryKey === o.categoryKey && p.offerId !== o.id);
  if (siblingPayments.some((p) => p.status === "paid")) return null;
  const stalePendingIds = siblingPayments.filter((p) => p.status === "pending").map((p) => p.id);
  if (stalePendingIds.length > 0) {
    await supabase.from("payments").update({ status: "failed" }).in("id", stalePendingIds);
  }

  // Welk abonnementsniveau (of nog de proefperiode) geldt NU voor deze
  // leverancier — deze offerte zelf wordt uitgesloten van de
  // boekingentelling, anders telt de laatste proefboeking zichzelf al mee
  // als de boeking die de proefperiode beëindigt (zie resolveEffectiveSupplierTier).
  const tier = await resolveEffectiveSupplierTier(o.supplierId, o.id);
  const commission = calculateCommission(o.totalPriceCents, tier);

  if (plan === "full") {
    const { data, error } = await supabase
      .from("payments")
      .insert({
        event_id: o.eventId,
        offer_id: o.id,
        category_key: o.categoryKey,
        supplier_amount_cents: commission.supplierAmount,
        platform_fee_cents: commission.platformFee,
        total_cents: commission.total,
        commission_rate: commission.rate,
        commission_tier: commission.tier,
        status: "pending",
        provider: "mock",
        installment: "full",
      })
      .select()
      .single();
    if (error || !data) return null;
    return rowToPayment(data);
  }

  const depositSupplier = Math.round(commission.supplierAmount * DEFAULT_DEPOSIT_PERCENT);
  const depositFee = Math.round(commission.platformFee * DEFAULT_DEPOSIT_PERCENT);
  const depositTotal = depositSupplier + depositFee;

  const { data: depositRow, error: depositError } = await supabase
    .from("payments")
    .insert({
      event_id: o.eventId,
      offer_id: o.id,
      category_key: o.categoryKey,
      supplier_amount_cents: depositSupplier,
      platform_fee_cents: depositFee,
      total_cents: depositTotal,
      commission_rate: commission.rate,
      commission_tier: commission.tier,
      status: "pending",
      provider: "mock",
      installment: "deposit",
    })
    .select()
    .single();
  if (depositError || !depositRow) return null;
  const deposit = rowToPayment(depositRow);

  const { error: balanceError } = await supabase.from("payments").insert({
    event_id: o.eventId,
    offer_id: o.id,
    category_key: o.categoryKey,
    supplier_amount_cents: commission.supplierAmount - depositSupplier,
    platform_fee_cents: commission.platformFee - depositFee,
    total_cents: commission.total - depositTotal,
    commission_rate: commission.rate,
    commission_tier: commission.tier,
    status: "pending",
    provider: "mock",
    installment: "balance",
    parent_payment_id: deposit.id,
  });
  if (balanceError) {
    // Aanbetaling staat er al — het restbedrag kon niet aangemaakt worden.
    // Niet stilzwijgend doorgaan met een halve betaalstructuur: ruim de
    // aanbetaling weer op en meld de mislukking, net als bij "full".
    await supabase.from("payments").delete().eq("id", deposit.id);
    return null;
  }

  return deposit;
}

export async function getPayment(paymentId: string): Promise<Payment | null> {
  const supabase = await sb();
  const { data } = await supabase.from("payments").select("*").eq("id", paymentId).single();
  return data ? rowToPayment(data) : null;
}

export async function getPaymentsForOffer(offerId: string): Promise<Payment[]> {
  const supabase = await sb();
  const { data } = await supabase.from("payments").select("*").eq("offer_id", offerId).order("created_at", { ascending: true });
  return (data ?? []).map(rowToPayment);
}

/**
 * Zet een betaling op "paid". Bij een offerte die in delen wordt betaald
 * (aanbetaling + restbedrag) wordt de bijbehorende vereiste pas op status
 * "paid" gezet zodra ÁLLE betalingen voor die offerte betaald zijn — zolang
 * alleen de aanbetaling binnen is, blijft de vereiste op "confirmed" staan
 * (die status wordt hieronder al gezet zodra de offerte geaccepteerd is).
 */
export async function markPaymentPaid(paymentId: string): Promise<Payment | null> {
  const supabase = await sb();

  // Een restbedrag mag nooit vóór zijn aanbetaling betaald worden — deze
  // check staat hier server-side (niet alleen als UI-hint) zodat hij ook
  // geldt als iemand rechtstreeks naar de checkout-URL van het restbedrag
  // navigeert of de actie direct aanroept.
  const existing = await getPayment(paymentId);
  if (!existing) return null;
  if (existing.installment === "balance" && existing.parentPaymentId) {
    const deposit = await getPayment(existing.parentPaymentId);
    if (deposit && deposit.status !== "paid") return null;
  }

  const { data, error } = await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", paymentId).select().single();
  if (error || !data) return null;
  const payment = rowToPayment(data);
  await acceptOffer(payment.offerId);
  const siblings = await getPaymentsForOffer(payment.offerId);
  const allPaid = siblings.length > 0 && siblings.every((p) => p.status === "paid");
  if (allPaid) {
    await updateRequirementStatus(payment.eventId, payment.categoryKey, "paid");
  }
  return payment;
}

export async function getPaymentsForEvent(eventId: string): Promise<Payment[]> {
  const supabase = await sb();
  const { data } = await supabase.from("payments").select("*").eq("event_id", eventId);
  return (data ?? []).map(rowToPayment);
}

/* ------------------------------------------------------------------ */
/* STRIPE-BETAALFLOW-VOORBEREIDING (spec-item #132)                    */
/*                                                                       */
/* Datamodel + integratiepunten voor een echte betaalflow via Stripe    */
/* Connect — zie supabase/migrations/0049_stripe_payment_prep.sql voor  */
/* het volledige model en de RLS-redenering. Dit blijft bewust          */
/* VOORBEREIDING: er wordt hier nergens een echte Stripe-API-aanroep    */
/* gedaan (dat vereist de `stripe`-npm-package + een echte secret key,  */
/* dus een eigen Stripe-account van Cem). De functies hieronder worden   */
/* pas bereikt vanuit app/api/webhooks/stripe/route.ts zodra die         */
/* daadwerkelijk is aangesloten.                                         */
/* ------------------------------------------------------------------ */

function rowToSupplierStripeAccount(r: Row): SupplierStripeAccount {
  return {
    supplierId: r.supplier_id,
    stripeAccountId: r.stripe_account_id ?? null,
    chargesEnabled: r.charges_enabled ?? false,
    payoutsEnabled: r.payouts_enabled ?? false,
    onboardedAt: r.onboarded_at ?? null,
    createdAt: r.created_at,
  };
}

/** Voor de leverancier zelf (bv. een toekomstige "Stripe koppelen"-sectie op /supplier/profile): status van de eigen Connect-koppeling lezen. Puur select — schrijven mag alleen via de service-role, zie hieronder. */
export async function getSupplierStripeAccount(supplierId: string): Promise<SupplierStripeAccount | null> {
  const supabase = await sb();
  const { data } = await supabase.from("supplier_stripe_accounts").select("*").eq("supplier_id", supplierId).maybeSingle();
  return data ? rowToSupplierStripeAccount(data) : null;
}

/**
 * Bijgewerkt vanuit de `account.updated`-webhook — altijd via de
 * service-role, nooit via de sessie van de leverancier zelf: zonder deze
 * grens zou een leverancier zichzelf `payoutsEnabled = true` kunnen geven
 * zonder dat Stripe dat ooit heeft bevestigd (zie migratie 49). Zet
 * `onboardedAt` precies één keer, op het moment dat beide vlaggen voor het
 * eerst tegelijk true worden — latere webhook-updates (bv. Stripe die een
 * vereiste later weer intrekt) overschrijven die eerste onboard-datum niet.
 */
export async function upsertSupplierStripeAccountFromWebhook(
  stripeAccountId: string,
  fields: { chargesEnabled: boolean; payoutsEnabled: boolean }
): Promise<SupplierStripeAccount | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data: existingRow } = await admin.from("supplier_stripe_accounts").select("*").eq("stripe_account_id", stripeAccountId).maybeSingle();
  if (!existingRow) return null;
  const existing = rowToSupplierStripeAccount(existingRow);
  const onboardedAt = existing.onboardedAt ?? (fields.chargesEnabled && fields.payoutsEnabled ? new Date().toISOString() : null);

  const { data, error } = await admin
    .from("supplier_stripe_accounts")
    .update({ charges_enabled: fields.chargesEnabled, payouts_enabled: fields.payoutsEnabled, onboarded_at: onboardedAt })
    .eq("stripe_account_id", stripeAccountId)
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return rowToSupplierStripeAccount(data);
}

/**
 * Vanuit de Stripe-webhook (checkout.session.completed in subscription-mode,
 * of customer.subscription.updated — bv. na een niveau-/interval-wissel of
 * een geslaagde herpoging ná invoice.payment_failed): zet het
 * abonnementsniveau, de facturatie-termijn en het daadwerkelijk betaalde
 * bedrag vast op basis van wat STRIPE zegt. Bewust NOOIT rechtstreeks vanuit
 * de server action zelf geschreven (die roept alleen de Stripe-API aan, zie
 * changeSubscriptionTierAction) — de webhook is de enige plek die de
 * database daadwerkelijk bijwerkt, zodat er nooit verschil kan ontstaan
 * tussen "wat de leverancier net aanklikte" en "wat Stripe daadwerkelijk
 * heeft doorgevoerd" (bv. bij een mislukte betaling of een race condition).
 * Zoekt de leverancier op via `supplierId` (uit de subscription-metadata,
 * gezet bij het aanmaken — zie changeSubscriptionTierAction) als die
 * meegegeven is, anders via het Stripe-klant-id.
 */
export async function applySupplierSubscriptionFromWebhook(params: {
  supplierId?: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  tier: SubscriptionTier;
  billingInterval: "monthly" | "annual";
  priceCents: number;
  status: SupplierAccount["subscriptionStatus"];
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  let supplierId = params.supplierId;
  if (!supplierId) {
    const { data } = await admin.from("suppliers").select("id").eq("stripe_customer_id", params.stripeCustomerId).maybeSingle();
    supplierId = data?.id;
  }
  if (!supplierId) return;

  await admin
    .from("suppliers")
    .update({
      subscription_tier: params.tier,
      billing_interval: params.billingInterval,
      subscription_price_cents: params.priceCents,
      subscription_status: params.status,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
    })
    .eq("id", supplierId);
}

/**
 * customer.subscription.deleted — het abonnement is écht beëindigd (na een
 * eerdere `cancel_at_period_end` bij een downgrade naar Instap, of doordat
 * betalingen definitief zijn mislukt na Stripe's eigen dunning-herpogingen).
 * Valt terug op het gratis Instap-niveau — precies zoals een leverancier die
 * zelf downgradet zonder actief abonnement.
 */
export async function resetSupplierToFreeTierFromWebhook(stripeSubscriptionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("suppliers")
    .update({
      subscription_tier: "instap",
      billing_interval: null,
      subscription_price_cents: null,
      subscription_status: "canceled",
      stripe_subscription_id: null,
    })
    .eq("stripe_subscription_id", stripeSubscriptionId);
}

/**
 * Alleen de status bijwerken, zonder het niveau aan te raken — voor
 * `invoice.payment_failed` (betaling voor de lopende periode mislukt; Stripe
 * probeert het via zijn eigen dunning-instellingen zelf nog een aantal keer
 * opnieuw, wij veranderen het niveau dus BEWUST nog niet) en voor
 * `customer.subscription.updated` als die geen (of geen bij ons bekende)
 * metadata bevat — bv. een statuswijziging die niet van onze eigen checkout
 * afkomstig is. Stripe stuurt zelf `customer.subscription.deleted` zodra een
 * abonnement definitief wordt beëindigd na uitgeputte herpogingen (zie
 * resetSupplierToFreeTierFromWebhook hierboven).
 */
export async function setSupplierSubscriptionStatusFromWebhook(stripeSubscriptionId: string, status: SupplierAccount["subscriptionStatus"]): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("suppliers").update({ subscription_status: status }).eq("stripe_subscription_id", stripeSubscriptionId);
}

/** Voor de webhook: een betaling opzoeken aan de hand van de Stripe Checkout-sessie die ervoor is aangemaakt (geen sessie/cookie beschikbaar in een inkomend webhook-request, dus service-role). */
export async function getPaymentByStripeCheckoutSessionId(sessionId: string): Promise<Payment | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("payments").select("*").eq("stripe_checkout_session_id", sessionId).maybeSingle();
  return data ? rowToPayment(data) : null;
}

/**
 * Service-role-tegenhanger van `markPaymentPaid` hierboven, voor gebruik
 * vanuit de Stripe-webhook (een inkomend webhook-request heeft geen
 * ingelogde gebruiker/sessie, dus `sb()` kan hier niet gebruikt worden —
 * zie ook `acceptOffer`/`updateRequirementStatus`, die wél sessie-gebonden
 * zijn en dus niet rechtstreeks herbruikt konden worden). Dupliceert
 * bewust dezelfde kernlogica (aanbetaling-vóór-restbedrag-check, offerte
 * accepteren, vereiste-status bijwerken, "alles betaald?"-check) via de
 * service-role. BELANGRIJK: wijzig je hier iets aan "wat gebeurt er bij
 * een geslaagde betaling", wijzig dan ook `markPaymentPaid`/`acceptOffer`/
 * `updateRequirementStatus` hierboven (en andersom) — anders lopen het
 * mock- en het Stripe-pad uit elkaar.
 */
export async function markPaymentPaidByWebhook(paymentId: string, opts: { stripePaymentIntentId: string }): Promise<Payment | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data: existingRow } = await admin.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!existingRow) return null;
  const existing = rowToPayment(existingRow);
  // Zelfde regel als in markPaymentPaid: een restbedrag mag nooit vóór zijn aanbetaling betaald worden.
  if (existing.installment === "balance" && existing.parentPaymentId) {
    const { data: depositRow } = await admin.from("payments").select("*").eq("id", existing.parentPaymentId).maybeSingle();
    const deposit = depositRow ? rowToPayment(depositRow) : null;
    if (deposit && deposit.status !== "paid") return null;
  }

  const { data, error } = await admin
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent_id: opts.stripePaymentIntentId })
    .eq("id", paymentId)
    .select()
    .single();
  if (error || !data) return null;
  const payment = rowToPayment(data);

  const { data: offerRow } = await admin.from("offers").update({ status: "accepted", swipe_decision: "shortlisted" }).eq("id", payment.offerId).select("category_key").maybeSingle();
  if (offerRow) {
    await admin.from("event_requirements").update({ status: "confirmed" }).eq("event_id", payment.eventId).eq("category_key", offerRow.category_key);
  }

  const { data: siblingRows } = await admin.from("payments").select("*").eq("offer_id", payment.offerId);
  const siblings = (siblingRows ?? []).map(rowToPayment);
  const allPaid = siblings.length > 0 && siblings.every((p) => p.status === "paid");
  if (allPaid) {
    await admin.from("event_requirements").update({ status: "paid" }).eq("event_id", payment.eventId).eq("category_key", payment.categoryKey);
  }

  return payment;
}

/* ------------------------------------------------------------------ */
/* MESSAGES                                                             */
/* ------------------------------------------------------------------ */

/**
 * `supplierId` is optioneel: de organisatoren-kant kent 'm niet altijd
 * vooraf (zie `app/events/[id]/messages/[category]/page.tsx`, waar hij pas
 * ná het opzoeken van de aanvraag bekend is) en zonder filter blijft het
 * bestaande gedrag exact hetzelfde. Wél meegeven zodra bekend — inclusief
 * altijd vanaf de leverancierskant — scopet het gesprek netjes tot precies
 * díe leverancier, ook in het randgeval dat eenzelfde categorie ooit naar
 * meerdere leveranciers is gestuurd.
 */
export async function getMessages(eventId: string, categoryKey: SupplierCategory, supplierId?: string): Promise<Message[]> {
  const supabase = await sb();
  let query = supabase.from("messages").select("*").eq("event_id", eventId).eq("category_key", categoryKey);
  if (supplierId) query = query.eq("supplier_id", supplierId);
  const { data } = await query.order("created_at", { ascending: true });
  const messages = (data ?? []).map(rowToMessage);
  if (messages.length === 0) return messages;

  // Bijlages + hun ondertekende URL's in twee losse, gebundelde aanroepen
  // i.p.v. per bericht — anders zou een gesprek met bv. 30 berichten 30
  // aparte round-trips naar de database én de opslagruimte doen.
  const { data: attachmentRows } = await supabase
    .from("message_attachments")
    .select("*")
    .in("message_id", messages.map((m) => m.id));
  if (!attachmentRows || attachmentRows.length === 0) return messages;

  const attachments = attachmentRows.map(rowToMessageAttachment);
  const paths = attachments.map((a) => a.storagePath);
  const { data: signedUrls } = await supabase.storage.from("message-attachments").createSignedUrls(paths, 60 * 60);
  const urlByPath = new Map((signedUrls ?? []).map((s) => [s.path, s.signedUrl]));

  const byMessageId = new Map<string, MessageAttachment[]>();
  for (const a of attachments) {
    const list = byMessageId.get(a.messageId) ?? [];
    list.push({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes, url: urlByPath.get(a.storagePath) ?? null });
    byMessageId.set(a.messageId, list);
  }
  for (const m of messages) m.attachments = byMessageId.get(m.id) ?? [];
  return messages;
}

export async function addMessage(
  msg: Omit<Message, "id" | "createdAt" | "attachments">,
  attachments?: { storagePath: string; fileName: string; mimeType: string; sizeBytes: number }[]
): Promise<Message> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("messages")
    .insert({ event_id: msg.eventId, category_key: msg.categoryKey, supplier_id: msg.supplierId, sender: msg.sender, text: msg.text })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Kon bericht niet opslaan");
  const message = rowToMessage(data);

  if (attachments && attachments.length > 0) {
    const { error: attachError } = await supabase.from("message_attachments").insert(
      attachments.map((a) => ({
        message_id: message.id,
        storage_path: a.storagePath,
        file_name: a.fileName,
        mime_type: a.mimeType,
        size_bytes: a.sizeBytes,
      }))
    );
    // Het bericht zelf staat er al (met tekst) — een mislukte bijlage-insert
    // (zeer onwaarschijnlijk, RLS is al gepasseerd bij de upload zelf) mag
    // dat niet met terugwerkende kracht ongedaan maken. We laten de bijlage
    // dan gewoon weg i.p.v. de hele verzending te laten falen.
    if (!attachError) message.attachments = attachments.map((a, i) => ({ id: `pending-${i}`, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes, url: null }));
  }

  return message;
}

/* ------------------------------------------------------------------ */
/* GASTENLIJST & RSVP                                                   */
/* ------------------------------------------------------------------ */

export async function getGuestsForEvent(eventId: string): Promise<EventGuest[]> {
  const supabase = await sb();
  const { data } = await supabase.from("event_guests").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
  return (data ?? []).map(rowToGuest);
}

export async function addGuest(eventId: string, patch: { name: string; email?: string | null; phone?: string | null; groupLabel?: string | null }): Promise<EventGuest | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("event_guests")
    .insert({ event_id: eventId, name: patch.name, email: patch.email ?? null, phone: patch.phone ?? null, group_label: patch.groupLabel ?? null })
    .select()
    .single();
  if (error || !data) return null;
  return rowToGuest(data);
}

/** Snel meerdere gasten tegelijk toevoegen op basis van een lijstje namen (één per regel). */
export async function addGuestsBulk(eventId: string, names: string[]): Promise<EventGuest[]> {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  if (cleaned.length === 0) return [];
  const supabase = await sb();
  const rows = cleaned.map((name) => ({ event_id: eventId, name }));
  const { data, error } = await supabase.from("event_guests").insert(rows).select();
  if (error || !data) return [];
  return data.map(rowToGuest);
}

export async function updateGuest(
  guestId: string,
  patch: Partial<{ name: string; email: string | null; phone: string | null; groupLabel: string | null; rsvpStatus: RsvpStatus; plusOnes: number; dietaryNotes: string | null }>
): Promise<EventGuest | null> {
  const supabase = await sb();
  const update: Row = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.email !== undefined) update.email = patch.email;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.groupLabel !== undefined) update.group_label = patch.groupLabel;
  if (patch.rsvpStatus !== undefined) {
    update.rsvp_status = patch.rsvpStatus;
    update.responded_at = new Date().toISOString();
  }
  if (patch.plusOnes !== undefined) update.plus_ones = patch.plusOnes;
  if (patch.dietaryNotes !== undefined) update.dietary_notes = patch.dietaryNotes;
  const { data, error } = await supabase.from("event_guests").update(update).eq("id", guestId).select().single();
  if (error || !data) return null;
  return rowToGuest(data);
}

export async function deleteGuest(guestId: string): Promise<void> {
  const supabase = await sb();
  await supabase.from("event_guests").delete().eq("id", guestId);
}

export interface GuestSummary {
  total: number; // inclusief plus-ones
  invited: number;
  yes: number;
  no: number;
  maybe: number;
  pending: number;
}

export function summarizeGuests(guests: EventGuest[]): GuestSummary {
  const yes = guests.filter((g) => g.rsvpStatus === "yes");
  const no = guests.filter((g) => g.rsvpStatus === "no").length;
  const maybe = guests.filter((g) => g.rsvpStatus === "maybe").length;
  const pending = guests.filter((g) => g.rsvpStatus === "pending").length;
  const total = yes.reduce((sum, g) => sum + 1 + g.plusOnes, 0);
  return { total, invited: guests.length, yes: yes.length, no, maybe, pending };
}

/**
 * Publieke RSVP-flow (zie migratie 0006): loopt via twee SECURITY DEFINER
 * Postgres-functies zodat een gast zijn eigen RSVP kan geven zonder in te
 * loggen en zonder dat de volledige gastenlijst van iedereen zichtbaar wordt.
 */
export async function getGuestPublic(guestId: string): Promise<GuestPublicInfo | null> {
  const supabase = await sb();
  const { data, error } = await supabase.rpc("get_guest_public", { p_guest_id: guestId }).maybeSingle();
  if (error || !data) return null;
  const r = data as Row;
  return {
    id: r.id,
    name: r.name,
    eventId: r.event_id,
    eventName: r.event_name,
    eventDate: r.event_date,
    eventLocation: r.event_location,
    rsvpStatus: r.rsvp_status,
    plusOnes: r.plus_ones ?? 0,
    dietaryNotes: r.dietary_notes ?? null,
  };
}

export async function submitRsvpPublic(guestId: string, status: "yes" | "no" | "maybe", plusOnes: number, dietaryNotes: string): Promise<boolean> {
  const supabase = await sb();
  const { error } = await supabase.rpc("submit_rsvp", { p_guest_id: guestId, p_status: status, p_plus_ones: plusOnes, p_dietary_notes: dietaryNotes || null });
  return !error;
}

/* ------------------------------------------------------------------ */
/* AI-INTERACTIELOGBOEK (beveiligde omgeving, zie migratie 0007)       */
/* ------------------------------------------------------------------ */

/**
 * Best-effort logging van elke AI-aanroep (zie lib/ai/client.ts), zodat de
 * platformbeheerder achteraf kan meelezen als er iets misgaat — inclusief
 * interacties die als verdacht (mogelijke prompt injection) zijn gemarkeerd.
 * Een fout bij het loggen zelf mag nooit de AI-flow van de gebruiker breken,
 * dus wordt die hier stilzwijgend afgevangen (en naar de server-console
 * gelogd) in plaats van doorgegooid.
 */
export async function logAiInteraction(entry: {
  role: string;
  userId: string | null;
  eventId: string | null;
  input: string;
  output: string | null;
  succeeded: boolean;
  flagged: boolean;
}): Promise<void> {
  try {
    const supabase = await sb();
    await supabase.from("ai_interaction_logs").insert({
      role: entry.role,
      user_id: entry.userId,
      event_id: entry.eventId,
      input: entry.input,
      output: entry.output,
      succeeded: entry.succeeded,
      flagged: entry.flagged,
    });
  } catch (err) {
    console.error("[ai_interaction_logs] Kon AI-interactie niet loggen.", err);
  }
}

export interface AiInteractionLog {
  id: string;
  role: string;
  userId: string | null;
  eventId: string | null;
  input: string;
  output: string | null;
  succeeded: boolean;
  flagged: boolean;
  createdAt: string;
}

/**
 * Voor het admin-dashboard: recente AI-interacties, meest recente eerst.
 * Deze tabel heeft bewust géén select-policy voor gewone gebruikers (zie
 * migratie 0007) — lezen kan dus alleen via de service-role client. Zonder
 * SUPABASE_SERVICE_ROLE_KEY geeft dit een lege lijst terug mét
 * `serviceRoleConfigured: false`, zodat de pagina dat kan onderscheiden van
 * "er zijn nog geen AI-interacties geweest".
 */
export async function listAiInteractionLogs(limit = 200): Promise<{ logs: AiInteractionLog[]; serviceRoleConfigured: boolean }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { logs: [], serviceRoleConfigured: false };
  const { data } = await admin.from("ai_interaction_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  return {
    logs: (data ?? []).map((r: Row) => ({
      id: r.id,
      role: r.role,
      userId: r.user_id,
      eventId: r.event_id,
      input: r.input,
      output: r.output,
      succeeded: r.succeeded,
      flagged: r.flagged,
      createdAt: r.created_at,
    })),
    serviceRoleConfigured: true,
  };
}

/* ------------------------------------------------------------------ */
/* NOTIFICATIONS                                                        */
/* ------------------------------------------------------------------ */

// Zonder limiet haalde dit ALTIJD de volledige notificatiegeschiedenis van
// een gebruiker op — voor de topbar-bel (die er toch maar 8 van toont) is
// dat onnodig, en voor de volledige notificatiepagina zou dit op termijn
// (na maanden gebruik) een steeds tragere, ongelimiteerde query worden. 100
// is ruim genoeg voor "alles wat de laatste tijd is gebeurd" op de
// notificatiepagina zelf.
export async function getNotifications(userId: string, limit = 100): Promise<AppNotification[]> {
  await ensureAutoNotifications(userId);
  const supabase = await sb();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map(rowToNotification);
}

/**
 * "Automatische herinneringen" zonder achtergrond-cronjob: bij elke keer dat
 * iemands meldingen worden opgehaald (dus bij vrijwel elke paginaload via de
 * topbar) controleren we live op verlopen reactietermijnen, naderende
 * planningsdeadlines en budgetoverschrijding, en maken daar zo nodig een
 * melding van. `dedupe_key` (migratie 0005) zorgt dat dezelfde situatie niet
 * telkens opnieuw een melding oplevert. Dit voelt voor de organisator
 * proactief aan, maar is nadrukkelijk in-app: er is nog geen e-mail/push-
 * infrastructuur die iemand bereikt die niet inlogt.
 */
async function ensureAutoNotifications(userId: string): Promise<void> {
  const events = await listEventsForUser(userId);
  const activeEvents = events.filter((e) => e.stage !== "completed" && e.stage !== "cancelled");
  const now = new Date();

  for (const event of activeEvents) {
    const [requests, budget, timeline] = await Promise.all([
      getRequestsForEvent(event.id),
      getBudgetSummary(event.id),
      getTimeline(event.id),
    ]);

    for (const req of requests) {
      if ((req.status === "sent" || req.status === "awaiting_response") && new Date(req.deadlineAt) < now) {
        await pushNotificationOnce(
          userId,
          event.id,
          {
            type: "deadline_approaching",
            title: "Nog geen reactie van leverancier",
            body: `De reactietermijn van 48 uur voor ${SUPPLIER_CATEGORY_LABELS[req.categoryKey]} bij "${event.name}" is verstreken.`,
            href: `/events/${event.id}/requests`,
          },
          `req-overdue-${req.id}`
        );
      }
    }

    if (budget.totalCents > 0 && budget.percentOverBudget > 0) {
      await pushNotificationOnce(
        userId,
        event.id,
        {
          type: "budget_exceeded",
          title: "Budget dreigt overschreden te worden",
          body: `Je verwachte kosten voor "${event.name}" liggen ${budget.percentOverBudget}% boven je budget.`,
          href: `/events/${event.id}/budget`,
        },
        `budget-exceeded-${event.id}`
      );
    }

    const soon = new Date(now);
    soon.setDate(soon.getDate() + 7);
    for (const item of timeline) {
      if (!item.done && item.dueDate) {
        const due = new Date(item.dueDate);
        if (due >= now && due <= soon) {
          await pushNotificationOnce(
            userId,
            event.id,
            {
              type: "event_deadline",
              title: "Planningsdeadline komt eraan",
              body: `"${item.title}" voor "${event.name}" staat binnenkort gepland (${item.leadTimeLabel}).`,
              href: `/events/${event.id}/timeline`,
            },
            `timeline-${item.id}`
          );
        }
      }
    }
  }
}

async function pushNotificationOnce(
  userId: string,
  eventId: string,
  n: { type: AppNotification["type"]; title: string; body: string; href: string },
  dedupeKey: string
): Promise<void> {
  const supabase = await sb();
  const { data: existing } = await supabase.from("notifications").select("id").eq("user_id", userId).eq("dedupe_key", dedupeKey).maybeSingle();
  if (existing) return;
  await supabase.from("notifications").insert({
    user_id: userId,
    event_id: eventId,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    dedupe_key: dedupeKey,
  });
}

/**
 * Meldingstypes die, naast de in-app-melding, ook een e-mail waard zijn —
 * bewust een beperkte selectie (nieuwe aanvraag, nieuwe/beantwoorde
 * offerte, verlopen reactietermijn) in plaats van alles: te veel mails
 * voelt al snel als spam, en niet elke melding (bv. "notitie bijgewerkt")
 * is dringend genoeg om iemands inbox te storen.
 */
const EMAIL_NOTIFICATION_TYPES = new Set<AppNotification["type"]>(["new_request", "new_offer", "supplier_responded", "deadline_approaching"]);

/**
 * BUGFIX (livegang-audit augustus 2026): gebruikte hier tot nu toe `sb()`
 * (de sessie-gebonden client) voor de insert — maar de aanroeper van
 * pushNotification() is bijna altijd een ANDERE gebruiker dan de ontvanger
 * (een leverancier die de organisator meldt dat er gereageerd is, een
 * organisator die een leverancier een nieuwe aanvraag stuurt, een admin die
 * een geschil oplost, ...). De RLS-policy op `notifications` staat alleen
 * `auth.uid() = user_id` toe (migratie 0001), dus zo'n insert voor een
 * ANDERE gebruiker werd altijd stilzwijgend geweigerd — deze functie gaf
 * dan gewoon `null` terug zonder dat er ergens een fout zichtbaar werd. Het
 * commentaar hieronder bij de e-mail-stap signaleerde dit probleem al
 * (vandaar de admin-client dáár), maar miste dat de insert er zelf ook aan
 * leed. Zelfde `admin ?? sb()`-terugvalpatroon als bij resolveDispute()/
 * approveSupplierVerification() hierboven.
 */
export async function pushNotification(n: Omit<AppNotification, "id" | "createdAt" | "read">): Promise<AppNotification | null> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data, error } = await supabase
    .from("notifications")
    .insert({ user_id: n.userId, event_id: n.eventId, type: n.type, title: n.title, body: n.body, href: n.href })
    .select()
    .single();
  if (error || !data) return null;

  if (EMAIL_ENABLED && EMAIL_NOTIFICATION_TYPES.has(n.type)) {
    // Los van de gewone (RLS-beperkte) client: de aanroeper van
    // pushNotification() is vaak een ANDERE gebruiker dan de ontvanger
    // (bv. een leverancier die de organisator een melding stuurt), en mag
    // diens profiel dus niet lezen. Zie de uitgebreide toelichting bij
    // createSupabaseAdminClient() in lib/supabase/admin.ts. Bewust
    // AWAITED (niet fire-and-forget) — in een serverless functie kan
    // niet-afgewachte achtergrondcode worden afgebroken zodra het
    // antwoord is verstuurd. try/catch eromheen zodat een hikkende
    // mailprovider nooit de eigenlijke actie (aanvraag versturen, offerte
    // indienen, ...) laat mislukken.
    try {
      const admin = createSupabaseAdminClient();
      if (admin) {
        const { data: profile } = await admin.from("profiles").select("email").eq("id", n.userId).maybeSingle();
        if (profile?.email) {
          await sendNotificationEmail({ to: profile.email, title: n.title, body: n.body, href: n.href });
        }
      }
    } catch (err) {
      console.error("[email] versturen van meldingsmail mislukt:", err);
    }
  }

  return rowToNotification(data);
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<AppNotification[]> {
  const supabase = await sb();
  await supabase.from("notifications").update({ read: true }).eq("id", notificationId).eq("user_id", userId);
  return getNotifications(userId);
}

export async function markAllNotificationsRead(userId: string): Promise<AppNotification[]> {
  const supabase = await sb();
  await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  return getNotifications(userId);
}

/* ------------------------------------------------------------------ */
/* GESCHILLEN (spec-item #50: geschillen kunnen melden/escaleren)      */
/* ------------------------------------------------------------------ */

/**
 * Meldt een geschil over een specifieke betaling/boeking. Werkt zowel voor
 * de organisator (filedByRole "customer") als de leverancier (filedByRole
 * "supplier") — RLS op de `disputes`-tabel controleert al dat de melder
 * daadwerkelijk bij deze boeking betrokken is (zie 0020_disputes.sql).
 * Notificeert de ANDERE partij (niet de admin — net als bij
 * verificatieaanvragen bekijkt Cem de wachtrij zelf op het admin-
 * dashboard i.p.v. een mail per melding te krijgen). Als de leverancier
 * geen écht (inlogbaar) account is (statische demo-catalogus-id), is er
 * niemand om te notificeren — geen fout, gewoon overslaan.
 */
export async function fileDispute(params: {
  paymentId: string;
  eventId: string;
  offerId: string;
  supplierId: string;
  filedBy: string;
  filedByRole: DisputeFiledByRole;
  category: DisputeCategory;
  description: string;
}): Promise<Dispute | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("disputes")
    .insert({
      payment_id: params.paymentId,
      event_id: params.eventId,
      offer_id: params.offerId,
      supplier_id: params.supplierId,
      filed_by: params.filedBy,
      filed_by_role: params.filedByRole,
      category: params.category,
      description: params.description,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Kon geschil niet melden");

  const [event, supplier] = await Promise.all([getEvent(params.eventId), getSupplierAccount(params.supplierId)]);
  const notifyBody = "Er is een geschil gemeld over een boeking. Bekijk de details en reageer.";
  if (params.filedByRole === "customer" && supplier) {
    await pushNotification({
      userId: supplier.ownerId,
      eventId: params.eventId,
      type: "dispute_filed",
      title: "Geschil gemeld",
      body: notifyBody,
      href: `/supplier/orders`,
    });
  } else if (params.filedByRole === "supplier" && event) {
    await pushNotification({
      userId: event.ownerId,
      eventId: params.eventId,
      type: "dispute_filed",
      title: "Geschil gemeld",
      body: notifyBody,
      href: `/events/${event.id}/checkout/${params.paymentId}`,
    });
  }

  return rowToDispute(data);
}

export async function getDisputesForPayment(paymentId: string): Promise<Dispute[]> {
  const supabase = await sb();
  const { data } = await supabase.from("disputes").select("*").eq("payment_id", paymentId).order("created_at", { ascending: false });
  return (data ?? []).map(rowToDispute);
}

/**
 * Alle geschillen over boekingen van deze leverancier, in één query i.p.v.
 * per order apart (N+1) — gebruikt door de bestellingenpagina, die de
 * resultaten zelf per `paymentId` groepeert. RLS beperkt dit al tot de
 * ingelogde leverancier zelf.
 */
export async function getDisputesForSupplier(supplierId: string): Promise<Dispute[]> {
  const supabase = await sb();
  const { data } = await supabase.from("disputes").select("*").eq("supplier_id", supplierId).order("created_at", { ascending: false });
  return (data ?? []).map(rowToDispute);
}

/**
 * Oplossen of afwijzen door een admin — uitsluitend via de service-role
 * client (bypassing RLS, want er is bewust geen UPDATE-policy voor gewone
 * gebruikers). Notificeert BEIDE betrokken partijen. Zie
 * requireAdmin()/approveSupplierVerificationAction in
 * lib/actions/admin-actions.ts voor het aanroeppatroon.
 */
export async function resolveDispute(
  disputeId: string,
  status: Exclude<DisputeStatus, "open">,
  adminResponse: string
): Promise<Dispute | null> {
  const admin = createSupabaseAdminClient();
  const supabase = admin ?? (await sb());
  const { data, error } = await supabase
    .from("disputes")
    .update({ status, admin_response: adminResponse, resolved_at: new Date().toISOString() })
    .eq("id", disputeId)
    .select()
    .single();
  if (error || !data) return null;
  const dispute = rowToDispute(data);

  const [event, supplier] = await Promise.all([getEvent(dispute.eventId), getSupplierAccount(dispute.supplierId)]);
  const title = status === "resolved" ? "Geschil opgelost" : "Geschil afgewezen";
  const type: AppNotification["type"] = status === "resolved" ? "dispute_resolved" : "dispute_dismissed";
  // BUG (gevonden aug. 2026, tijdens het bouwen van organisator/leverancier-
  // contextlabels op notificaties): beide partijen kregen altijd dezelfde href
  // naar de organisator-checkoutpagina. app/events/[id]/layout.tsx stuurt
  // iedereen die niet event.ownerId is meteen door naar /events, dus voor de
  // leverancier was dit een dode link naar een pagina die meteen wegstuurt.
  // Zelfde tweeledige aanroeppatroon als hierboven bij "filed" — elke partij
  // krijgt nu zijn eigen, werkende bestemming.
  if (event) {
    await pushNotification({
      userId: event.ownerId,
      eventId: dispute.eventId,
      type,
      title,
      body: adminResponse,
      href: `/events/${dispute.eventId}/checkout/${dispute.paymentId}`,
    });
  }
  if (supplier) {
    await pushNotification({
      userId: supplier.ownerId,
      eventId: dispute.eventId,
      type,
      title,
      body: adminResponse,
      href: "/supplier/orders",
    });
  }

  return dispute;
}

export async function listAllDisputes(): Promise<Dispute[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase.from("disputes").select("*").order("created_at", { ascending: false });
  return (data ?? []).map(rowToDispute);
}

export function allSuppliers() {
  return SUPPLIERS;
}

/* ------------------------------------------------------------------ */
/* ADMIN AGGREGATES                                                     */
/*                                                                       */
/* Gebruikt de service-role client (lib/supabase/admin.ts) zodra         */
/* SUPABASE_SERVICE_ROLE_KEY geconfigureerd is, zodat het admin-         */
/* dashboard écht platformbreed is (alle gebruikers/events, niet alleen  */
/* die van de ingelogde beheerder). Zonder die sleutel valt elke functie */
/* hieronder terug op de gewone (RLS-beperkte) client, en zie je dus     */
/* alleen je eigen data — de admin-pagina toont in dat geval een banner. */
/* ------------------------------------------------------------------ */

// `.order()` toegevoegd op beide — zonder ORDER BY garandeert Postgres geen
// enkele rijvolgorde, waardoor het admin-dashboard "Recente evenementen"
// toonde die helemaal niet per se recent waren. De KPI-tellingen
// (events.length, GMV-som, ...) blijven ongewijzigd correct, want die lezen
// nog steeds de volledige lijst — alleen de WEERGAVEVOLGORDE verandert hier.
export async function listAllEvents(): Promise<EventCore[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
  return (data ?? []).map((r) => rowToEvent(r));
}

export async function listAllPayments(): Promise<Payment[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
  return (data ?? []).map(rowToPayment);
}

export async function listAllRequests(): Promise<ServiceRequest[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase.from("requests").select("*");
  return (data ?? []).map(rowToRequest);
}

export async function listAllOffers(): Promise<OfferOption[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase.from("offers").select("*");
  return (data ?? []).map(rowToOffer);
}

export async function listAllUsers(): Promise<UserAccount[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase.from("profiles").select("*");
  return (data ?? []).map(rowToUser);
}

// Bugfix: het admin-dashboard toonde tot nu toe bij "Leveranciers"/"Top
// leveranciers" de statische demo-catalogus (`allSuppliers()`, uit
// lib/data/suppliers.ts) i.p.v. echte, geregistreerde leveranciersaccounts.
// Daardoor waren nieuwe verificatieaanvragen (en leveranciers in het
// algemeen) nooit zichtbaar voor de beheerder. Deze functie haalt de échte
// `suppliers`-tabel op, net als de andere admin-aggregaten hierboven.
export async function listAllSupplierAccounts(): Promise<SupplierAccount[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase.from("suppliers").select("*");
  return (data ?? []).map(rowToSupplierAccount);
}

/* ------------------------------------------------------------------ */
/* ADMIN — dagelijks AI-team-rapport (spec-item #52 vervolg)           */
/*                                                                       */
/* Zie lib/ai/briefing.ts voor de narratieve laag (samenvatting +        */
/* koppen per teamlid) en supabase/migrations/0021_admin_briefings.sql   */
/* voor het schema. Alleen via de service-role client — vereist dus      */
/* SUPABASE_SERVICE_ROLE_KEY, net als de rest van dit admin-blok.        */
/* ------------------------------------------------------------------ */

function rowToAdminBriefingItem(r: Row): AdminBriefingItem {
  return {
    id: r.id,
    briefingId: r.briefing_id,
    teamMember: r.team_member,
    kind: r.kind,
    title: r.title,
    description: r.description,
    requiresApproval: r.requires_approval,
    relatedType: r.related_type ?? null,
    relatedId: r.related_id ?? null,
    status: r.status,
    createdAt: r.created_at,
  };
}

function rowToAdminBriefing(r: Row, items: AdminBriefingItem[]): AdminBriefing {
  return {
    id: r.id,
    coordinatorSummary: r.coordinator_summary,
    teamHeadlines: r.team_headlines ?? {},
    since: r.since,
    usedAI: r.used_ai,
    createdAt: r.created_at,
    items,
  };
}

/** Meest recente dagrapport + bijbehorende punten — null als er nog nooit één is gegenereerd (of geen service-role sleutel). */
export async function getLatestAdminBriefing(): Promise<AdminBriefing | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data: briefingRow } = await admin.from("admin_briefings").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!briefingRow) return null;

  const { data: itemRows } = await admin
    .from("admin_briefing_items")
    .select("*")
    .eq("briefing_id", briefingRow.id)
    .order("requires_approval", { ascending: false })
    .order("created_at", { ascending: true });

  return rowToAdminBriefing(briefingRow, (itemRows ?? []).map(rowToAdminBriefingItem));
}

/** Eén punt uit een rapport goedkeuren/afwijzen/negeren — de eigenlijke actie (bv. leverancier verifiëren) gebeurt apart, dit is puur de rapport-status. */
export async function markBriefingItemStatus(itemId: string, status: BriefingItemStatus): Promise<AdminBriefingItem | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("admin_briefing_items").update({ status }).eq("id", itemId).select().single();
  if (error || !data) return null;
  return rowToAdminBriefingItem(data);
}

/**
 * Genereert het dagrapport en slaat het op — aangeroepen door zowel de
 * cronjob (app/api/cron/daily-briefing/route.ts, dagelijks) als de
 * "Genereer nu"-knop in het admin-dashboard (handig voor een eerste
 * rapport, of als Cem tussendoor een vers overzicht wil).
 *
 * Belangrijk: WELKE items er in het rapport komen (openstaande
 * verificaties, openstaande geschillen, nieuwe aanmeldingen, gemarkeerde
 * AI-interacties, financiële samenvatting) wordt hier volledig
 * deterministisch uit de database gehaald — de AI-laag (lib/ai/briefing.ts)
 * schrijft alleen de begeleidende tekst erbij op basis van de kale
 * aantallen, en verzint dus nooit zelf een item of een id.
 *
 * "Openstaand" (verificaties, geschillen) is bewust NIET beperkt tot
 * "sinds het laatste rapport" — die blijven anders verschijnen totdat ze
 * zijn afgehandeld. "Nieuw" (aanmeldingen, betalingen, gemarkeerde
 * AI-logs) is wél beperkt tot sinds het laatste rapport, anders zou
 * bijvoorbeeld elke leverancier die ooit is aangemeld elke dag opnieuw
 * als "nieuw" verschijnen.
 *
 * Twee latere, puur informatieve toevoegingen (geen "requires_approval",
 * alleen een "Gezien"-knop): leveranciers die de reactietermijn op een
 * aanvraag hebben laten verlopen ("supplier_unresponsive", via
 * `request_targets` — de enige plek die per leverancier bijhoudt of hij al
 * heeft gereageerd) en evenementen die een tijd niet zijn bijgewerkt
 * ("organizer_stalled", ORGANIZER_STALLED_DAYS in lib/config.ts). Beide
 * gebruiken dezelfde "alleen de dag dat het gebeurt"-redenering als
 * hierboven: alleen wat SINDS het vorige rapport de drempel is
 * gepasseerd, anders zou hetzelfde punt elke dag opnieuw verschijnen
 * totdat iemand het handmatig wegklikt.
 */
export async function generateAndStoreDailyBriefing(): Promise<AdminBriefing | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data: lastBriefingRow } = await admin.from("admin_briefings").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const since = lastBriefingRow?.created_at ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sinceMs = new Date(since).getTime();

  const [suppliers, disputes, users, payments, aiLogs, requests, events, pendingTargetRows] = await Promise.all([
    listAllSupplierAccounts(),
    listAllDisputes(),
    listAllUsers(),
    listAllPayments(),
    listAiInteractionLogs(200),
    listAllRequests(),
    listAllEvents(),
    admin.from("request_targets").select("*").eq("status", "pending").then((r) => r.data ?? []),
  ]);

  const pendingVerifications = suppliers.filter((s) => !s.verified && s.verificationRequestedAt);
  const openDisputes = disputes.filter((d) => d.status === "open");
  const newSuppliers = suppliers.filter((s) => new Date(s.createdAt).getTime() > sinceMs);
  const newUsers = users.filter((u) => new Date(u.createdAt).getTime() > sinceMs);
  const newPayments = payments.filter((p) => p.status === "paid" && new Date(p.paidAt ?? p.createdAt).getTime() > sinceMs);
  const flaggedLogs = aiLogs.logs.filter((l) => l.flagged && new Date(l.createdAt).getTime() > sinceMs);
  const revenueCents = newPayments.reduce((sum, p) => sum + p.platformFeeCents, 0);

  // "Leverancier heeft de reactietermijn laten verlopen" (puur informatief
  // — geen "requires_approval"). `request_targets` (niet `requests` zelf)
  // is de bron van waarheid per leverancier: een aanvraag gaat naar 3-5
  // leveranciers tegelijk, en alleen déze tussentabel houdt per leverancier
  // bij of hij al heeft gereageerd (zie submitSupplierOffer() hierboven).
  // Alleen requests waarvan de deadline SINDS het vorige rapport is
  // verstreken tellen mee — anders zou dezelfde overschrijding elke dag
  // opnieuw verschijnen totdat de leverancier alsnog reageert.
  const requestById = new Map(requests.map((r) => [r.id, r]));
  const nowMs = Date.now();
  const unresponsiveCountBySupplier = new Map<string, number>();
  for (const row of pendingTargetRows) {
    const target = rowToRequestTarget(row);
    const request = requestById.get(target.requestId);
    if (!request) continue;
    const deadlineMs = new Date(request.deadlineAt).getTime();
    if (deadlineMs > nowMs || deadlineMs <= sinceMs) continue; // nog niet verlopen, of al eerder gerapporteerd
    unresponsiveCountBySupplier.set(target.supplierId, (unresponsiveCountBySupplier.get(target.supplierId) ?? 0) + 1);
  }

  // "Evenement lijkt stilgevallen" (eveneens puur informatief) — alleen
  // evenementen die de inactiviteitsdrempel PAS SINDS het vorige rapport
  // zijn gepasseerd (zelfde eenmalige-melding-redenering als hierboven).
  const activeStages: EventStage[] = ["draft", "planning", "sourcing", "booking"];
  const stalledThresholdMs = ORGANIZER_STALLED_DAYS * 24 * 60 * 60 * 1000;
  const newlyStalledEvents = events.filter((e) => {
    if (!activeStages.includes(e.stage)) return false;
    const inactiveMs = nowMs - new Date(e.updatedAt).getTime();
    const inactiveMsAtLastReport = sinceMs - new Date(e.updatedAt).getTime();
    return inactiveMs >= stalledThresholdMs && inactiveMsAtLastReport < stalledThresholdMs;
  });

  const { narrative, usedAI } = await generateBriefingNarrative({
    pendingVerifications: pendingVerifications.length,
    openDisputes: openDisputes.length,
    newSuppliers: newSuppliers.length,
    newUsers: newUsers.length,
    flaggedAiCount: flaggedLogs.length,
    paymentsCount: newPayments.length,
    revenueCents,
    unresponsiveSupplierCount: unresponsiveCountBySupplier.size,
    stalledEventCount: newlyStalledEvents.length,
  });

  type NewItem = Omit<AdminBriefingItem, "id" | "briefingId" | "status" | "createdAt">;
  const items: NewItem[] = [];

  for (const s of pendingVerifications) {
    items.push({
      teamMember: BRIEFING_TEAM_MEMBERS.verificatie,
      kind: "supplier_verification",
      title: `Verifieer ${s.companyName}`,
      description: `KVK: ${s.kvkNumber ?? "onbekend"} · ${s.contactPerson} · ${s.baseLocation}`,
      requiresApproval: true,
      relatedType: "supplier",
      relatedId: s.id,
    });
  }

  for (const d of openDisputes) {
    items.push({
      teamMember: BRIEFING_TEAM_MEMBERS.vertrouwen,
      kind: "dispute",
      title: `Geschil: ${DISPUTE_CATEGORY_LABELS[d.category]}`,
      description: d.description,
      requiresApproval: true,
      relatedType: "dispute",
      relatedId: d.id,
    });
  }

  if (newSuppliers.length > 0) {
    const names = newSuppliers.slice(0, 5).map((s) => s.companyName);
    items.push({
      teamMember: BRIEFING_TEAM_MEMBERS.groei,
      kind: "new_supplier",
      title: `${newSuppliers.length} nieuwe leverancier${newSuppliers.length === 1 ? "" : "s"}`,
      description: names.join(", ") + (newSuppliers.length > names.length ? ` en ${newSuppliers.length - names.length} meer` : ""),
      requiresApproval: false,
      relatedType: null,
      relatedId: null,
    });
  }

  if (newUsers.length > 0) {
    items.push({
      teamMember: BRIEFING_TEAM_MEMBERS.groei,
      kind: "new_users",
      title: `${newUsers.length} nieuwe gebruiker${newUsers.length === 1 ? "" : "s"}`,
      description: "Nieuwe accounts sinds het vorige rapport — geen actie nodig.",
      requiresApproval: false,
      relatedType: null,
      relatedId: null,
    });
  }

  if (newPayments.length > 0) {
    items.push({
      teamMember: BRIEFING_TEAM_MEMBERS.financien,
      kind: "financial",
      title: `${newPayments.length} nieuwe betaling${newPayments.length === 1 ? "" : "en"}`,
      description: `Samen ${formatCurrency(revenueCents)} aan platformkosten sinds het vorige rapport.`,
      requiresApproval: false,
      relatedType: null,
      relatedId: null,
    });
  }

  if (flaggedLogs.length > 0) {
    items.push({
      teamMember: BRIEFING_TEAM_MEMBERS.veiligheid,
      kind: "flagged_ai",
      title: `${flaggedLogs.length} AI-interactie${flaggedLogs.length === 1 ? "" : "s"} gemarkeerd`,
      description: "Mogelijke prompt-injection-poging(en) — zie het AI-interactielogboek verderop op deze pagina.",
      requiresApproval: false,
      relatedType: null,
      relatedId: null,
    });
  }

  // Puur informatief (geen "requires_approval"): een enkele late reactie
  // is normaal, maar als het patroon zich herhaalt is dat iets waard om
  // te weten — vandaar per leverancier, niet per losse aanvraag.
  for (const [supplierId, count] of unresponsiveCountBySupplier) {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) continue;
    items.push({
      teamMember: BRIEFING_TEAM_MEMBERS.vertrouwen,
      kind: "supplier_unresponsive",
      title: `${supplier.companyName}: ${count} aanvraag${count === 1 ? "" : "en"} niet beantwoord binnen ${SUPPLIER_RESPONSE_WINDOW_HOURS} uur`,
      description: "De reactietermijn is verstreken zonder offerte of afwijzing — kan de moeite waard zijn om even te informeren of alles goed gaat bij deze leverancier.",
      requiresApproval: false,
      relatedType: "supplier",
      relatedId: supplier.id,
    });
  }

  for (const e of newlyStalledEvents) {
    const owner = users.find((u) => u.id === e.ownerId);
    items.push({
      teamMember: BRIEFING_TEAM_MEMBERS.groei,
      kind: "organizer_stalled",
      title: `"${e.name}" lijkt stilgevallen`,
      description: `${owner ? `${owner.firstName} ${owner.lastName}` : "Deze organisator"} heeft dit evenement al ${ORGANIZER_STALLED_DAYS}+ dagen niet bijgewerkt (fase: ${e.stage}).`,
      requiresApproval: false,
      relatedType: "event",
      relatedId: e.id,
    });
  }

  const teamHeadlinesByName = Object.fromEntries(
    (Object.keys(BRIEFING_TEAM_MEMBERS) as BriefingTeamKey[]).map((key) => [BRIEFING_TEAM_MEMBERS[key], narrative.teamHeadlines[key]])
  );

  const { data: briefingRow, error } = await admin
    .from("admin_briefings")
    .insert({ coordinator_summary: narrative.coordinatorSummary, team_headlines: teamHeadlinesByName, since, used_ai: usedAI })
    .select()
    .single();
  if (error || !briefingRow) {
    console.error("[briefing] opslaan mislukt:", error?.message);
    return null;
  }

  if (items.length > 0) {
    const { error: itemsError } = await admin.from("admin_briefing_items").insert(
      items.map((it) => ({
        briefing_id: briefingRow.id,
        team_member: it.teamMember,
        kind: it.kind,
        title: it.title,
        description: it.description,
        requires_approval: it.requiresApproval,
        related_type: it.relatedType,
        related_id: it.relatedId,
      }))
    );
    if (itemsError) console.error("[briefing] items opslaan mislukt:", itemsError.message);
  }

  const actionableCount = pendingVerifications.length + openDisputes.length;
  for (const adminEmail of ADMIN_EMAILS) {
    await sendNotificationEmail({
      to: adminEmail,
      title: actionableCount > 0 ? `Dagrapport: ${actionableCount} punt${actionableCount === 1 ? "" : "en"} vraagt aandacht` : "Dagrapport: niets te melden",
      body: narrative.coordinatorSummary,
      href: "/admin",
      ctaLabel: "Bekijk volledig rapport",
    });
  }

  return getLatestAdminBriefing();
}

// `uid()` blijft beschikbaar voor eventuele client-side tijdelijke ids
// (bv. optimistic UI keys) — niet meer gebruikt voor database-ids, want
// Postgres genereert nu zelf uuid's.
export { uid };
