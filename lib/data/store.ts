import "server-only";
import { uid } from "@/lib/utils";
import { PLATFORM_COMMISSION_RATE, SUPPLIER_RESPONSE_WINDOW_HOURS, calculateCommission } from "@/lib/config";
import { SUPPLIERS, suppliersByCategory } from "@/lib/data/suppliers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AiInterviewMessage,
  AppNotification,
  EventBudgetSummary,
  EventCore,
  EventNote,
  EventReadiness,
  EventTask,
  EventTimelineItem,
  Message,
  OfferOption,
  Payment,
  RequirementCategory,
  RequirementPriority,
  RiskFlag,
  ServiceRequest,
  SupplierCategory,
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

async function sb() {
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
    avatarColor: r.avatar_color ?? "#6D5CF0",
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
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    provider: r.provider,
  };
}

function rowToMessage(r: Row): Message {
  return { id: r.id, eventId: r.event_id, categoryKey: r.category_key, supplierId: r.supplier_id, sender: r.sender, text: r.text, createdAt: r.created_at };
}

function rowToNotification(r: Row): AppNotification {
  return { id: r.id, userId: r.user_id, eventId: r.event_id, type: r.type, title: r.title, body: r.body ?? "", read: r.read, createdAt: r.created_at, href: r.href };
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
    name: "name", type: "type", stage: "stage", description: "description", date: "date",
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

/* ------------------------------------------------------------------ */
/* PAYMENTS                                                             */
/* ------------------------------------------------------------------ */

export async function createPaymentForOffer(offerId: string): Promise<Payment | null> {
  const supabase = await sb();
  const o = await getOffer(offerId);
  if (!o) return null;
  const commission = calculateCommission(o.totalPriceCents, PLATFORM_COMMISSION_RATE);
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
      status: "pending",
      provider: "mock",
    })
    .select()
    .single();
  if (error || !data) return null;
  return rowToPayment(data);
}

export async function getPayment(paymentId: string): Promise<Payment | null> {
  const supabase = await sb();
  const { data } = await supabase.from("payments").select("*").eq("id", paymentId).single();
  return data ? rowToPayment(data) : null;
}

export async function markPaymentPaid(paymentId: string): Promise<Payment | null> {
  const supabase = await sb();
  const { data, error } = await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", paymentId).select().single();
  if (error || !data) return null;
  const payment = rowToPayment(data);
  await acceptOffer(payment.offerId);
  await updateRequirementStatus(payment.eventId, payment.categoryKey, "paid");
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

export async function getMessages(eventId: string, categoryKey: SupplierCategory): Promise<Message[]> {
  const supabase = await sb();
  const { data } = await supabase.from("messages").select("*").eq("event_id", eventId).eq("category_key", categoryKey).order("created_at", { ascending: true });
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
/* NOTIFICATIONS                                                        */
/* ------------------------------------------------------------------ */

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const supabase = await sb();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return (data ?? []).map(rowToNotification);
}

export async function pushNotification(n: Omit<AppNotification, "id" | "createdAt" | "read">): Promise<AppNotification | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("notifications")
    .insert({ user_id: n.userId, event_id: n.eventId, type: n.type, title: n.title, body: n.body, href: n.href })
    .select()
    .single();
  if (error || !data) return null;
  return rowToNotification(data);
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<AppNotification[]> {
  const supabase = await sb();
  await supabase.from("notifications").update({ read: true }).eq("id", notificationId).eq("user_id", userId);
  return getNotifications(userId);
}

export function allSuppliers() {
  return SUPPLIERS;
}

/* ------------------------------------------------------------------ */
/* ADMIN AGGREGATES                                                     */
/*                                                                       */
/* Let op: deze queries lopen via de gewone (RLS-beperkte) client, dus   */
/* laten in deze fase alleen data van de ingelogde gebruiker zelf zien.  */
/* Een echt platform-breed admin-dashboard heeft een aparte, met een     */
/* service-role sleutel beveiligde route nodig — bewust nog niet         */
/* aangesloten (admin is een lichte stub, zie docs/ARCHITECTURE.md).     */
/* ------------------------------------------------------------------ */

export async function listAllEvents(): Promise<EventCore[]> {
  const supabase = await sb();
  const { data } = await supabase.from("events").select("*");
  return (data ?? []).map((r) => rowToEvent(r));
}

export async function listAllPayments(): Promise<Payment[]> {
  const supabase = await sb();
  const { data } = await supabase.from("payments").select("*");
  return (data ?? []).map(rowToPayment);
}

export async function listAllRequests(): Promise<ServiceRequest[]> {
  const supabase = await sb();
  const { data } = await supabase.from("requests").select("*");
  return (data ?? []).map(rowToRequest);
}

export async function listAllOffers(): Promise<OfferOption[]> {
  const supabase = await sb();
  const { data } = await supabase.from("offers").select("*");
  return (data ?? []).map(rowToOffer);
}

export async function listAllUsers(): Promise<UserAccount[]> {
  const supabase = await sb();
  const { data } = await supabase.from("profiles").select("*");
  return (data ?? []).map(rowToUser);
}

// `uid()` blijft beschikbaar voor eventuele client-side tijdelijke ids
// (bv. optimistic UI keys) — niet meer gebruikt voor database-ids, want
// Postgres genereert nu zelf uuid's.
export { uid };
