import "server-only";
import { uid } from "@/lib/utils";
import {
  CommissionTier,
  DEFAULT_DEPOSIT_PERCENT,
  EMAIL_ENABLED,
  INTRO_BOOKING_COUNT,
  SUPPLIER_RESPONSE_WINDOW_HOURS,
  calculateCommission,
} from "@/lib/config";
import { SUPPLIERS, suppliersByCategory, getSupplierById } from "@/lib/data/suppliers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendNotificationEmail } from "@/lib/email/send";
import {
  AiInterviewMessage,
  AppNotification,
  EventBudgetSummary,
  EventCore,
  EventGuest,
  EventNote,
  EventReadiness,
  EventTask,
  EventTimelineItem,
  GuestPublicInfo,
  Message,
  NextStep,
  OfferOption,
  Payment,
  RequestTarget,
  RequirementCategory,
  RequirementPriority,
  RiskFlag,
  RsvpStatus,
  ServiceRequest,
  SUPPLIER_CATEGORY_LABELS,
  SupplierAccount,
  SupplierBlockedDate,
  SupplierCategory,
  SupplierFavorite,
  SupplierLead,
  SupplierOrder,
  SupplierProfile,
  UserAccount,
} from "@/lib/types";

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
  };
}

function rowToMessage(r: Row): Message {
  return { id: r.id, eventId: r.event_id, categoryKey: r.category_key, supplierId: r.supplier_id, sender: r.sender, text: r.text, createdAt: r.created_at };
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
    proSubscribed: r.pro_subscribed ?? false,
    proSubscribedAt: r.pro_subscribed_at ?? null,
    storeOpen: r.store_open ?? true,
    createdAt: r.created_at,
  };
}

function rowToRequestTarget(r: Row): RequestTarget {
  return { id: r.id, requestId: r.request_id, supplierId: r.supplier_id, status: r.status, createdAt: r.created_at };
}

function rowToSupplierBlockedDate(r: Row): SupplierBlockedDate {
  return { id: r.id, supplierId: r.supplier_id, date: r.date, createdAt: r.created_at };
}

function rowToSupplierFavorite(r: Row): SupplierFavorite {
  return { id: r.id, userId: r.user_id, supplierId: r.supplier_id, createdAt: r.created_at };
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
  category?: SupplierCategory;
  location?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  query?: string;
}): Promise<SupplierAccount[]> {
  const supabase = await sb();
  // Een leverancier die zichzelf op "gesloten" heeft gezet (spec-item #55)
  // mag niet gevonden worden — dat is precies het doel van die schakelaar.
  let dbQuery = supabase.from("suppliers").select("*").eq("store_open", true);
  if (filters.category) dbQuery = dbQuery.contains("categories", [filters.category]);
  if (filters.location) dbQuery = dbQuery.ilike("base_location", `%${filters.location}%`);
  if (filters.minPriceCents != null) dbQuery = dbQuery.gte("avg_price_cents", filters.minPriceCents);
  if (filters.maxPriceCents != null) dbQuery = dbQuery.lte("avg_price_cents", filters.maxPriceCents);
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

/** Uploadt een logo/foto naar de "supplier-media"-opslagruimte en geeft de publieke URL terug (of null bij een fout). */
export async function uploadSupplierFile(ownerId: string, file: File, folder: "logo" | "gallery"): Promise<string | null> {
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

/** Zet een écht leveranciersaccount om naar de "weergave-vorm" die overal (offertes, shortlist, gesprekken) wordt gebruikt om suppliers te tonen. */
export function supplierAccountToProfileShape(account: SupplierAccount): SupplierProfile {
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
  return account ? supplierAccountToProfileShape(account) : null;
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
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Kon leveranciersprofiel niet aanmaken");
  // Rol bijwerken zodat de rest van de app (redirects e.d.) weet dat dit een leverancier is.
  await supabase.from("profiles").update({ role: "supplier" }).eq("id", ownerId);
  return rowToSupplierAccount(data);
}

export async function updateSupplierAccount(
  supplierId: string,
  patch: Partial<SupplierProfilePatch> & { logoUrl?: string | null; galleryUrls?: string[] }
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
  const { data, error } = await supabase.from("suppliers").update(update).eq("id", supplierId).select().single();
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
/* COMMISSIEMODEL (spec-item #53: instaptarief / gestaffeld / Pro)     */
/* ------------------------------------------------------------------ */

/**
 * Aantal succesvol AFGERONDE boekingen van deze leverancier tot nu toe —
 * bepaalt of hij nog in zijn instapperiode zit (zie `INTRO_BOOKING_COUNT`
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
 * Welke commissielaag geldt op dit moment voor deze leverancier? Pro gaat
 * voor (een Pro-leverancier betaalt nooit ook nog het instaptarief), daarna
 * de instapperiode, daarna het gestaffelde tarief. Gebruikt zowel bij het
 * daadwerkelijk aanmaken van een betaling (`createPaymentForOffer`) als
 * puur informatief op het leveranciersprofiel (`getSupplierCommissionStatus`).
 */
export async function resolveSupplierCommissionTier(supplierId: string, excludeOfferId?: string): Promise<CommissionTier> {
  const supplier = await getSupplierAccount(supplierId);
  if (supplier?.proSubscribed) return "pro";
  const priorBookings = await countAcceptedOffersForSupplier(supplierId, excludeOfferId);
  return priorBookings < INTRO_BOOKING_COUNT ? "intro" : "tiered";
}

/** Voor weergave op het leveranciersprofiel: huidige laag + hoeveel instapboekingen er nog over zijn. */
export async function getSupplierCommissionStatus(supplierId: string): Promise<{
  tier: CommissionTier;
  acceptedBookingsCount: number;
  introBookingsRemaining: number;
}> {
  const [tier, acceptedBookingsCount] = await Promise.all([
    resolveSupplierCommissionTier(supplierId),
    countAcceptedOffersForSupplier(supplierId),
  ]);
  return { tier, acceptedBookingsCount, introBookingsRemaining: Math.max(0, INTRO_BOOKING_COUNT - acceptedBookingsCount) };
}

/**
 * Vyra Pro aan/uit — vast maandbedrag i.p.v. commissie per boeking (spec-item
 * #53, laag 3). Nog een zelfbedienings-toggle zonder automatische incasso —
 * zelfde "mock"-aanpak als de rest van de betaalflow in deze app (zie
 * `provider: "mock"` bij `createPaymentForOffer`), dus geen halve/misleidende
 * facturatie voordat er een echte Stripe-koppeling voor abonnementen is.
 */
export async function setSupplierProSubscription(supplierId: string, active: boolean): Promise<void> {
  const supabase = await sb();
  await supabase
    .from("suppliers")
    .update({ pro_subscribed: active, pro_subscribed_at: active ? new Date().toISOString() : null })
    .eq("id", supplierId);
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
 * is de vereniging van (a) zelf-geblokkeerde datums (`supplier_blocked_dates`)
 * en (b) leveranciers die op die datum al een BEVESTIGDE boeking hebben
 * (`offers.status === "accepted"` voor een event met diezelfde datum) — een
 * leverancier die al ergens anders geboekt is, kan een nieuwe aanvraag voor
 * dezelfde dag toch niet uitvoeren. Bewust twee losse, simpele queries + een
 * JS-filter op `event.date` (i.p.v. een PostgREST-embedded-filter) — zelfde
 * patroon als elders in dit bestand (zie `getSupplierOrders`), en de
 * kandidaatpool hier is altijd klein genoeg (een paar tientallen) om dat
 * probleemloos te doen.
 */
async function getUnavailableSupplierIds(supplierIds: string[], date: string): Promise<Set<string>> {
  if (supplierIds.length === 0) return new Set();
  const supabase = await sb();
  const [blockedRes, bookedRes] = await Promise.all([
    supabase.from("supplier_blocked_dates").select("supplier_id").eq("date", date).in("supplier_id", supplierIds),
    supabase.from("offers").select("supplier_id, event:events(date)").eq("status", "accepted").in("supplier_id", supplierIds),
  ]);
  const unavailable = new Set<string>((blockedRes.data ?? []).map((r: Row) => r.supplier_id as string));
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

  const scored = pool.map((sup) => {
    let score = 60;
    if (opts.locationLabel && sup.serviceAreas.some((a) => a.toLowerCase().includes(opts.locationLabel!.toLowerCase()))) {
      score += 20;
    }
    score += Math.round(sup.ratingAvg * 4);
    if (sup.verified) score += 5;
    // Eén van de Vyra Pro-perks (spec-item #53, laag 3): een bescheiden
    // voorrangsboost in de matching — vergelijkbaar met de "geverifieerd"-
    // boost hierboven, net iets hoger omdat dit een betaald voordeel is.
    if (sup.proSubscribed) score += 8;
    const unavailableOnDate = unavailableIds.has(sup.id);
    return { supplier: sup, score: Math.min(99, score), unavailableOnDate };
  });
  scored.sort((a, b) => {
    if (a.unavailableOnDate !== b.unavailableOnDate) return a.unavailableOnDate ? 1 : -1;
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

export interface SupplierEarningsSummary {
  paidCents: number;
  pendingCents: number;
  openLeadsCount: number;
  activeOrdersCount: number;
  upcomingThisMonthCount: number;
}

export async function getSupplierEarningsSummary(supplierId: string): Promise<SupplierEarningsSummary> {
  const [orders, leads] = await Promise.all([getSupplierOrders(supplierId), getSupplierLeads(supplierId)]);
  const paidCents = orders.filter((o) => o.payment?.status === "paid").reduce((sum, o) => sum + (o.payment?.supplierAmountCents ?? 0), 0);
  const pendingCents = orders.filter((o) => o.payment && o.payment.status !== "paid").reduce((sum, o) => sum + (o.payment?.supplierAmountCents ?? 0), 0);
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
  // Welke commissielaag geldt NU voor deze leverancier (instap/gestaffeld/Pro)
  // — deze offerte zelf wordt uitgesloten van de boekingentelling, anders
  // telt boeking 5 zichzelf al mee als boeking 6 (zie resolveSupplierCommissionTier).
  const tier = await resolveSupplierCommissionTier(o.supplierId, o.id);
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
  return (data ?? []).map(rowToMessage);
}

export async function addMessage(msg: Omit<Message, "id" | "createdAt">): Promise<Message> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("messages")
    .insert({ event_id: msg.eventId, category_key: msg.categoryKey, supplier_id: msg.supplierId, sender: msg.sender, text: msg.text })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Kon bericht niet opslaan");
  return rowToMessage(data);
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

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  await ensureAutoNotifications(userId);
  const supabase = await sb();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
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

export async function pushNotification(n: Omit<AppNotification, "id" | "createdAt" | "read">): Promise<AppNotification | null> {
  const supabase = await sb();
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

export async function listAllEvents(): Promise<EventCore[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase.from("events").select("*");
  return (data ?? []).map((r) => rowToEvent(r));
}

export async function listAllPayments(): Promise<Payment[]> {
  const supabase = createSupabaseAdminClient() ?? (await sb());
  const { data } = await supabase.from("payments").select("*");
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

// `uid()` blijft beschikbaar voor eventuele client-side tijdelijke ids
// (bv. optimistic UI keys) — niet meer gebruikt voor database-ids, want
// Postgres genereert nu zelf uuid's.
export { uid };
