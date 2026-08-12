import "server-only";
import { uid } from "@/lib/utils";
import { PLATFORM_COMMISSION_RATE, SUPPLIER_RESPONSE_WINDOW_HOURS, calculateCommission } from "@/lib/config";
import { SUPPLIERS, suppliersByCategory } from "@/lib/data/suppliers";
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
import { buildDemoEvents } from "@/lib/data/seed";

/**
 * In-memory "database" voor deze demo.
 *
 * Dit is bewust een simpele, in-process store achter een repository-achtige
 * API (dezelfde functienamen als je in een echte backend zou verwachten).
 * In productie vervang je alleen de binnenkant van deze functies door
 * Postgres/Supabase-queries — de rest van de applicatie (components, routes,
 * AI-laag) blijft ongewijzigd, omdat die alleen tegen deze functies praat.
 *
 * We gebruiken `globalThis` zodat de state hot-reloads in dev overleeft.
 */

interface Db {
  users: Map<string, UserAccount>;
  events: Map<string, EventCore>;
  interview: Map<string, AiInterviewMessage[]>;
  requirements: Map<string, RequirementCategory[]>;
  requests: Map<string, ServiceRequest>;
  offers: Map<string, OfferOption>;
  timeline: Map<string, EventTimelineItem[]>;
  tasks: Map<string, EventTask[]>;
  risks: Map<string, RiskFlag[]>;
  payments: Map<string, Payment>;
  messages: Map<string, Message[]>;
  notifications: Map<string, AppNotification[]>;
}

const g = globalThis as unknown as { __eventflowDb?: Db };

function createEmptyDb(): Db {
  return {
    users: new Map(),
    events: new Map(),
    interview: new Map(),
    requirements: new Map(),
    requests: new Map(),
    offers: new Map(),
    timeline: new Map(),
    tasks: new Map(),
    risks: new Map(),
    payments: new Map(),
    messages: new Map(),
    notifications: new Map(),
  };
}

function getDb(): Db {
  if (!g.__eventflowDb) {
    g.__eventflowDb = createEmptyDb();
    seedDb(g.__eventflowDb);
  }
  return g.__eventflowDb;
}

export const DEMO_USER_ID = "user_demo_cem";

function seedDb(db: Db) {
  const demoUser: UserAccount = {
    id: DEMO_USER_ID,
    role: "customer",
    email: "cemadiyaman91@gmail.com",
    firstName: "Cem",
    lastName: "Adıyaman",
    country: "NL",
    language: "nl",
    currency: "EUR",
    createdAt: new Date().toISOString(),
    avatarColor: "#6D5CF0",
  };
  db.users.set(demoUser.id, demoUser);

  const demo = buildDemoEvents(demoUser.id);
  for (const bundle of demo) {
    db.events.set(bundle.event.id, bundle.event);
    db.interview.set(bundle.event.id, bundle.interview);
    db.requirements.set(bundle.event.id, bundle.requirements);
    db.timeline.set(bundle.event.id, bundle.timeline);
    db.tasks.set(bundle.event.id, bundle.tasks);
    db.risks.set(bundle.event.id, bundle.risks);
    for (const r of bundle.requests) db.requests.set(r.id, r);
    for (const o of bundle.offers) db.offers.set(o.id, o);
    for (const p of bundle.payments) db.payments.set(p.id, p);
    for (const m of bundle.messages) {
      const list = db.messages.get(m.categoryKey + "__" + bundle.event.id) ?? [];
      list.push(m);
      db.messages.set(m.categoryKey + "__" + bundle.event.id, list);
    }
  }

  db.notifications.set(demoUser.id, [
    {
      id: uid("notif"),
      userId: demoUser.id,
      eventId: demo[0].event.id,
      type: "new_offer",
      title: "Nieuwe offerte ontvangen",
      body: "Moment Photography heeft een offerte gestuurd voor Fotografie.",
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      href: `/events/${demo[0].event.id}/offers/photography`,
    },
    {
      id: uid("notif"),
      userId: demoUser.id,
      eventId: demo[0].event.id,
      type: "deadline_approaching",
      title: "Deadline nadert",
      body: "3 leveranciers voor Catering hebben nog 14 uur om te reageren.",
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      href: `/events/${demo[0].event.id}/requests`,
    },
    {
      id: uid("notif"),
      userId: demoUser.id,
      eventId: demo[0].event.id,
      type: "budget_exceeded",
      title: "Budget-alert",
      body: "Je zit momenteel 8% boven je oorspronkelijke budget voor Catering.",
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
      href: `/events/${demo[0].event.id}/budget`,
    },
  ]);
}

/* ------------------------------------------------------------------ */
/* USERS                                                               */
/* ------------------------------------------------------------------ */

export function getUser(userId: string): UserAccount | null {
  return getDb().users.get(userId) ?? null;
}

export function getOrCreateUser(email: string, extra?: Partial<UserAccount>): UserAccount {
  const db = getDb();
  const existing = [...db.users.values()].find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) return existing;
  const user: UserAccount = {
    id: uid("user"),
    role: "customer",
    email,
    firstName: extra?.firstName ?? "",
    lastName: extra?.lastName ?? "",
    country: extra?.country ?? "NL",
    language: extra?.language ?? "nl",
    currency: extra?.currency ?? "EUR",
    createdAt: new Date().toISOString(),
    avatarColor: ["#6D5CF0", "#FF5A46", "#1C8A54", "#B8892B"][Math.floor(Math.random() * 4)],
  };
  db.users.set(user.id, user);
  return user;
}

export function updateUser(userId: string, patch: Partial<UserAccount>): UserAccount | null {
  const db = getDb();
  const u = db.users.get(userId);
  if (!u) return null;
  const updated = { ...u, ...patch };
  db.users.set(userId, updated);
  return updated;
}

/* ------------------------------------------------------------------ */
/* EVENTS                                                               */
/* ------------------------------------------------------------------ */

export function listEventsForUser(userId: string): EventCore[] {
  return [...getDb().events.values()]
    .filter((e) => e.ownerId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getEvent(eventId: string): EventCore | null {
  return getDb().events.get(eventId) ?? null;
}

export function createEvent(ownerId: string, description: string): EventCore {
  const now = new Date().toISOString();
  const event: EventCore = {
    id: uid("event"),
    ownerId,
    name: "Nieuw evenement",
    type: "other",
    stage: "draft",
    createdAt: now,
    updatedAt: now,
    date: null,
    startTime: null,
    endTime: null,
    timezone: "Europe/Amsterdam",
    guestCountAdults: null,
    guestCountChildren: null,
    locationLabel: null,
    locationType: null,
    indoorOutdoor: null,
    budget: null,
    style: null,
    theme: null,
    formality: null,
    isProfessional: false,
    description,
    notes: [],
  };
  getDb().events.set(event.id, event);
  getDb().interview.set(event.id, []);
  getDb().requirements.set(event.id, []);
  getDb().timeline.set(event.id, []);
  getDb().tasks.set(event.id, []);
  getDb().risks.set(event.id, []);
  return event;
}

export function updateEvent(eventId: string, patch: Partial<EventCore>): EventCore | null {
  const db = getDb();
  const e = db.events.get(eventId);
  if (!e) return null;
  const updated = { ...e, ...patch, updatedAt: new Date().toISOString() };
  db.events.set(eventId, updated);
  return updated;
}

export function addEventNote(eventId: string, text: string, source: EventNote["source"], impactSummary?: string) {
  const e = getEvent(eventId);
  if (!e) return null;
  const note: EventNote = { id: uid("note"), eventId, text, createdAt: new Date().toISOString(), source, impactSummary };
  const updated = { ...e, notes: [note, ...e.notes], updatedAt: new Date().toISOString() };
  getDb().events.set(eventId, updated);
  return note;
}

/* ------------------------------------------------------------------ */
/* AI INTERVIEW                                                        */
/* ------------------------------------------------------------------ */

export function getInterviewMessages(eventId: string): AiInterviewMessage[] {
  return getDb().interview.get(eventId) ?? [];
}

export function addInterviewMessage(msg: Omit<AiInterviewMessage, "id" | "createdAt">): AiInterviewMessage {
  const db = getDb();
  const full: AiInterviewMessage = { ...msg, id: uid("msg"), createdAt: new Date().toISOString() };
  const list = db.interview.get(msg.eventId) ?? [];
  list.push(full);
  db.interview.set(msg.eventId, list);
  return full;
}

/* ------------------------------------------------------------------ */
/* REQUIREMENTS / PLAN                                                 */
/* ------------------------------------------------------------------ */

export function getRequirements(eventId: string): RequirementCategory[] {
  return getDb().requirements.get(eventId) ?? [];
}

export function setRequirements(eventId: string, categories: RequirementCategory[]) {
  getDb().requirements.set(eventId, categories);
  return categories;
}

export function toggleRequirementSelection(eventId: string, categoryId: string, selected: boolean) {
  const list = getRequirements(eventId);
  const updated = list.map((c) => (c.id === categoryId ? { ...c, selected, status: selected ? ("selected" as const) : c.status } : c));
  getDb().requirements.set(eventId, updated);
  return updated;
}

export function updateRequirementStatus(eventId: string, categoryKey: SupplierCategory, status: RequirementCategory["status"]) {
  const list = getRequirements(eventId);
  const updated = list.map((c) => (c.categoryKey === categoryKey ? { ...c, status } : c));
  getDb().requirements.set(eventId, updated);
  return updated;
}

/* ------------------------------------------------------------------ */
/* SUPPLIERS / MATCHING                                                */
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

export function getRequestsForEvent(eventId: string): ServiceRequest[] {
  return [...getDb().requests.values()].filter((r) => r.eventId === eventId);
}

export function getRequest(requestId: string): ServiceRequest | null {
  return getDb().requests.get(requestId) ?? null;
}

export function createAndSendRequest(params: {
  eventId: string;
  categoryKey: SupplierCategory;
  desiredService: string;
  specialRequests: string;
  budgetCents: number | null;
  locationLabel?: string | null;
}): { request: ServiceRequest; offers: OfferOption[] } {
  const db = getDb();
  const matches = findMatchingSuppliers(params.categoryKey, { locationLabel: params.locationLabel, limit: 4 });
  const sentAt = new Date();
  const deadline = new Date(sentAt.getTime() + SUPPLIER_RESPONSE_WINDOW_HOURS * 60 * 60 * 1000);

  const request: ServiceRequest = {
    id: uid("req"),
    eventId: params.eventId,
    categoryKey: params.categoryKey,
    supplierIds: matches.map((m) => m.supplier.id),
    desiredService: params.desiredService,
    specialRequests: params.specialRequests,
    budgetCents: params.budgetCents,
    status: "awaiting_response",
    sentAt: sentAt.toISOString(),
    deadlineAt: deadline.toISOString(),
  };
  db.requests.set(request.id, request);

  // Demo-modus: we simuleren dat leveranciers (met wisselende snelheid)
  // binnen de 48-uursvenster reageren, zodat de kernflow direct te
  // ervaren is. In productie komt dit binnen via het supplier-portaal.
  const offers: OfferOption[] = matches.map(({ supplier, score }) => {
    const willRespond = Math.random() < 0.85;
    if (!willRespond) {
      return null;
    }
    const priceVariance = 0.85 + Math.random() * 0.35;
    const total = Math.round(supplier.avgPriceCents * priceVariance * (params.categoryKey === "catering" ? 1 : 1));
    const offer: OfferOption = {
      id: uid("offer"),
      requestId: request.id,
      eventId: params.eventId,
      supplierId: supplier.id,
      categoryKey: params.categoryKey,
      status: "available",
      totalPriceCents: total,
      pricePerPersonCents: null,
      includes: defaultIncludes(params.categoryKey),
      excludes: defaultExcludes(params.categoryKey),
      extraCostsNote: Math.random() > 0.6 ? "Reiskosten buiten 25km: €0,45/km" : null,
      staffIncluded: Math.random() > 0.4,
      deliveryIncluded: Math.random() > 0.3,
      setupIncluded: Math.random() > 0.3,
      teardownIncluded: Math.random() > 0.5,
      travelCostsCents: Math.random() > 0.7 ? 7500 : null,
      cancellationPolicy: "Kosteloos annuleren tot 60 dagen vooraf, daarna 50% van het totaalbedrag verschuldigd.",
      paymentTerms: "50% aanbetaling bij boeking, restant 14 dagen voor het evenement.",
      validUntil: new Date(sentAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      remarks: null,
      matchScore: score,
      matchRationale: buildMatchRationale(supplier, score, params.locationLabel ?? null),
      respondedAt: new Date(sentAt.getTime() + Math.random() * 40 * 60 * 60 * 1000).toISOString(),
      swipeDecision: "none",
    };
    return offer;
  }).filter(Boolean) as OfferOption[];

  for (const o of offers) db.offers.set(o.id, o);

  if (offers.length > 0) {
    request.status = "responded";
  }

  return { request, offers };
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

export function getOffersForEvent(eventId: string, categoryKey?: SupplierCategory): OfferOption[] {
  return [...getDb().offers.values()].filter((o) => o.eventId === eventId && (!categoryKey || o.categoryKey === categoryKey));
}

export function getOffer(offerId: string): OfferOption | null {
  return getDb().offers.get(offerId) ?? null;
}

export function decideSwipe(offerId: string, decision: "shortlisted" | "rejected" | "none") {
  const db = getDb();
  const o = db.offers.get(offerId);
  if (!o) return null;
  const updated: OfferOption = {
    ...o,
    swipeDecision: decision,
    status: decision === "shortlisted" ? "shortlisted" : decision === "rejected" ? "declined" : o.status,
  };
  db.offers.set(offerId, updated);
  return updated;
}

export function acceptOffer(offerId: string) {
  const db = getDb();
  const o = db.offers.get(offerId);
  if (!o) return null;
  const updated: OfferOption = { ...o, status: "accepted", swipeDecision: "shortlisted" };
  db.offers.set(offerId, updated);
  updateRequirementStatus(o.eventId, o.categoryKey, "confirmed");
  return updated;
}

export function getShortlistForEvent(eventId: string) {
  return getOffersForEvent(eventId).filter((o) => o.swipeDecision === "shortlisted" || o.status === "accepted" || o.status === "shortlisted");
}

/* ------------------------------------------------------------------ */
/* TIMELINE / TASKS / RISKS                                            */
/* ------------------------------------------------------------------ */

export function getTimeline(eventId: string): EventTimelineItem[] {
  return getDb().timeline.get(eventId) ?? [];
}
export function setTimeline(eventId: string, items: EventTimelineItem[]) {
  getDb().timeline.set(eventId, items);
  return items;
}
export function toggleTimelineDone(eventId: string, itemId: string, done: boolean) {
  const list = getTimeline(eventId).map((i) => (i.id === itemId ? { ...i, done } : i));
  getDb().timeline.set(eventId, list);
  return list;
}

export function getTasks(eventId: string): EventTask[] {
  return getDb().tasks.get(eventId) ?? [];
}
export function setTasks(eventId: string, items: EventTask[]) {
  getDb().tasks.set(eventId, items);
  return items;
}
export function toggleTaskDone(eventId: string, taskId: string, done: boolean) {
  const list = getTasks(eventId).map((t) => (t.id === taskId ? { ...t, done } : t));
  getDb().tasks.set(eventId, list);
  return list;
}

export function getRisks(eventId: string): RiskFlag[] {
  return getDb().risks.get(eventId) ?? [];
}
export function setRisks(eventId: string, risks: RiskFlag[]) {
  getDb().risks.set(eventId, risks);
  return risks;
}

/* ------------------------------------------------------------------ */
/* BUDGET & READINESS                                                  */
/* ------------------------------------------------------------------ */

export function getBudgetSummary(eventId: string): EventBudgetSummary {
  const event = getEvent(eventId);
  const totalCents = event?.budget?.totalCents ?? 0;
  const offers = getOffersForEvent(eventId);
  const committedCents = offers.filter((o) => o.status === "accepted").reduce((sum, o) => sum + o.totalPriceCents, 0);
  const reqs = getRequirements(eventId);
  const pendingCents = reqs
    .filter((r) => r.selected && r.status !== "confirmed" && r.status !== "paid" && r.status !== "completed")
    .reduce((sum, r) => sum + (r.estimatedBudgetCents ?? 0), 0);
  const remainingCents = totalCents - committedCents - pendingCents;
  const projected = committedCents + pendingCents;
  const percentOverBudget = totalCents > 0 && projected > totalCents ? Math.round(((projected - totalCents) / totalCents) * 100) : 0;
  return { totalCents, committedCents, pendingCents, remainingCents, percentOverBudget };
}

export function computeReadiness(eventId: string): EventReadiness {
  const reqs = getRequirements(eventId);
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

export function createPaymentForOffer(offerId: string): Payment | null {
  const o = getOffer(offerId);
  if (!o) return null;
  const commission = calculateCommission(o.totalPriceCents, PLATFORM_COMMISSION_RATE);
  const payment: Payment = {
    id: uid("pay"),
    eventId: o.eventId,
    offerId: o.id,
    categoryKey: o.categoryKey,
    supplierAmountCents: commission.supplierAmount,
    platformFeeCents: commission.platformFee,
    totalCents: commission.total,
    commissionRate: commission.rate,
    status: "pending",
    createdAt: new Date().toISOString(),
    paidAt: null,
    provider: "mock",
  };
  getDb().payments.set(payment.id, payment);
  return payment;
}

export function getPayment(paymentId: string): Payment | null {
  return getDb().payments.get(paymentId) ?? null;
}

export function markPaymentPaid(paymentId: string): Payment | null {
  const db = getDb();
  const p = db.payments.get(paymentId);
  if (!p) return null;
  const updated: Payment = { ...p, status: "paid", paidAt: new Date().toISOString() };
  db.payments.set(paymentId, updated);
  acceptOffer(p.offerId);
  updateRequirementStatus(p.eventId, p.categoryKey, "paid");
  return updated;
}

export function getPaymentsForEvent(eventId: string): Payment[] {
  return [...getDb().payments.values()].filter((p) => p.eventId === eventId);
}

/* ------------------------------------------------------------------ */
/* MESSAGES                                                             */
/* ------------------------------------------------------------------ */

export function getMessages(eventId: string, categoryKey: SupplierCategory): Message[] {
  return getDb().messages.get(categoryKey + "__" + eventId) ?? [];
}

export function addMessage(msg: Omit<Message, "id" | "createdAt">): Message {
  const db = getDb();
  const full: Message = { ...msg, id: uid("msg"), createdAt: new Date().toISOString() };
  const key = msg.categoryKey + "__" + msg.eventId;
  const list = db.messages.get(key) ?? [];
  list.push(full);
  db.messages.set(key, list);
  return full;
}

/* ------------------------------------------------------------------ */
/* NOTIFICATIONS                                                        */
/* ------------------------------------------------------------------ */

export function getNotifications(userId: string): AppNotification[] {
  return (getDb().notifications.get(userId) ?? []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function pushNotification(n: Omit<AppNotification, "id" | "createdAt" | "read">) {
  const db = getDb();
  const full: AppNotification = { ...n, id: uid("notif"), createdAt: new Date().toISOString(), read: false };
  const list = db.notifications.get(n.userId) ?? [];
  list.unshift(full);
  db.notifications.set(n.userId, list);
  return full;
}

export function markNotificationRead(userId: string, notificationId: string) {
  const db = getDb();
  const list = db.notifications.get(userId) ?? [];
  const updated = list.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
  db.notifications.set(userId, updated);
  return updated;
}

export function allSuppliers() {
  return SUPPLIERS;
}

/* ------------------------------------------------------------------ */
/* ADMIN AGGREGATES                                                     */
/* ------------------------------------------------------------------ */

export function listAllEvents(): EventCore[] {
  return [...getDb().events.values()];
}

export function listAllPayments(): Payment[] {
  return [...getDb().payments.values()];
}

export function listAllRequests(): ServiceRequest[] {
  return [...getDb().requests.values()];
}

export function listAllOffers(): OfferOption[] {
  return [...getDb().offers.values()];
}

export function listAllUsers(): UserAccount[] {
  return [...getDb().users.values()];
}
