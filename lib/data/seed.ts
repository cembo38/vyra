import { uid } from "@/lib/utils";
import { calculateCommission } from "@/lib/config";
import {
  AiInterviewMessage,
  EventCore,
  EventTask,
  EventTimelineItem,
  Message,
  OfferOption,
  Payment,
  RequirementCategory,
  RiskFlag,
  ServiceRequest,
  SupplierCategory,
} from "@/lib/types";

/**
 * Realistische demo-data zodat de applicatie er vanaf de eerste klik
 * overtuigend uitziet (zie productspec §50). Dit is expliciet DEMO-data:
 * in een schone productie-omgeving start elke gebruiker met een lege
 * "Mijn evenementen"-lijst.
 */

export interface EventBundle {
  event: EventCore;
  interview: AiInterviewMessage[];
  requirements: RequirementCategory[];
  timeline: EventTimelineItem[];
  tasks: EventTask[];
  risks: RiskFlag[];
  requests: ServiceRequest[];
  offers: OfferOption[];
  payments: Payment[];
  messages: Message[];
}

function offer(params: {
  eventId: string;
  requestId: string;
  categoryKey: SupplierCategory;
  supplierId: string;
  totalPriceCents: number;
  status: OfferOption["status"];
  swipeDecision?: OfferOption["swipeDecision"];
  includes: string[];
  excludes?: string[];
  matchScore: number;
  matchRationale: string;
  respondedHoursAgo: number;
  extraCostsNote?: string | null;
}): OfferOption {
  return {
    id: uid("offer"),
    requestId: params.requestId,
    eventId: params.eventId,
    supplierId: params.supplierId,
    categoryKey: params.categoryKey,
    status: params.status,
    totalPriceCents: params.totalPriceCents,
    pricePerPersonCents: null,
    includes: params.includes,
    excludes: params.excludes ?? [],
    extraCostsNote: params.extraCostsNote ?? null,
    staffIncluded: true,
    deliveryIncluded: true,
    setupIncluded: true,
    teardownIncluded: Math.random() > 0.4,
    travelCostsCents: null,
    cancellationPolicy: "Kosteloos annuleren tot 60 dagen vooraf, daarna 50% van het totaalbedrag verschuldigd.",
    paymentTerms: "50% aanbetaling bij boeking, restant 14 dagen voor het evenement.",
    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    remarks: null,
    matchScore: params.matchScore,
    matchRationale: params.matchRationale,
    respondedAt: new Date(Date.now() - params.respondedHoursAgo * 60 * 60 * 1000).toISOString(),
    swipeDecision: params.swipeDecision ?? "none",
  };
}

function request(params: {
  eventId: string;
  categoryKey: SupplierCategory;
  supplierIds: string[];
  desiredService: string;
  specialRequests: string;
  budgetCents: number | null;
  status: ServiceRequest["status"];
  sentHoursAgo: number;
}): ServiceRequest {
  const sentAt = new Date(Date.now() - params.sentHoursAgo * 60 * 60 * 1000);
  return {
    id: uid("req"),
    eventId: params.eventId,
    categoryKey: params.categoryKey,
    supplierIds: params.supplierIds,
    desiredService: params.desiredService,
    specialRequests: params.specialRequests,
    budgetCents: params.budgetCents,
    status: params.status,
    sentAt: sentAt.toISOString(),
    deadlineAt: new Date(sentAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    targetSupplierId: null,
    isDirect: false,
  };
}

function req(params: {
  eventId: string;
  categoryKey: SupplierCategory;
  label: string;
  priority: RequirementCategory["priority"];
  aiRationale: string;
  estimatedBudgetCents: number;
  status: RequirementCategory["status"];
}): RequirementCategory {
  return {
    id: uid("reqc"),
    eventId: params.eventId,
    categoryKey: params.categoryKey,
    label: params.label,
    priority: params.priority,
    aiRationale: params.aiRationale,
    selected: true,
    estimatedBudgetCents: params.estimatedBudgetCents,
    draftMessage: null,
    status: params.status,
  };
}

export function buildDemoEvents(ownerId: string): EventBundle[] {
  return [buildWeddingEvent(ownerId), buildBirthdayEvent(ownerId)];
}

/* ==================================================================== */
/* DEMO EVENT 1 — Emma & Lucas' bruiloft                                 */
/* ==================================================================== */

function buildWeddingEvent(ownerId: string): EventBundle {
  const now = new Date();
  const eventDate = "2027-06-15";
  const eventId = uid("event");

  const event: EventCore = {
    id: eventId,
    ownerId,
    name: "Emma & Lucas' bruiloft",
    type: "wedding",
    stage: "booking",
    createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    date: eventDate,
    monthHint: null,
    startTime: "15:00",
    endTime: "23:59",
    timezone: "Europe/Amsterdam",
    guestCountAdults: 112,
    guestCountChildren: 8,
    locationLabel: "Amsterdam",
    locationType: "external_venue",
    indoorOutdoor: "both",
    budget: { totalCents: 2_500_000, source: "user" },
    style: "Modern & tijdloos, met botanische accenten",
    theme: "Zachte pasteltinten met veel groen",
    formality: "formal",
    isProfessional: false,
    description:
      "Ik wil in juni een luxe bruiloft organiseren voor ongeveer 120 mensen in Amsterdam. We willen een mix van een chique diner en een feestavond met dansen.",
    notes: [
      {
        id: uid("note"),
        eventId,
        text: "Definitieve gastenlijst is bijgesteld naar 120 personen (was 100).",
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        source: "user",
        impactSummary: "AI raadt aan de cateringaanvraag opnieuw te laten doorrekenen voor 120 in plaats van 100 gasten.",
      },
    ],
  };

  const interview: AiInterviewMessage[] = [
    { id: uid("msg"), eventId, role: "user", text: event.description, createdAt: event.createdAt },
    {
      id: uid("msg"),
      eventId,
      role: "assistant",
      text: "Wat feestelijk! Een bruiloft voor 120 gasten in Amsterdam — daar ga ik je graag bij helpen. Hoeveel gasten verwacht je ongeveer, inclusief kinderen?",
      createdAt: event.createdAt,
    },
    { id: uid("msg"), eventId, role: "user", text: "Rond de 120, waarvan een stuk of 8 kinderen.", createdAt: event.createdAt },
    {
      id: uid("msg"),
      eventId,
      role: "assistant",
      text: "Genoteerd. Heb je al een locatie op het oog, of mag ik daar suggesties voor zoeken?",
      createdAt: event.createdAt,
    },
    { id: uid("msg"), eventId, role: "user", text: "Nog niet, we zoeken iets met binnen- en buitenruimte, in of net buiten Amsterdam.", createdAt: event.createdAt },
    {
      id: uid("msg"),
      eventId,
      role: "assistant",
      text: "Mooi, dat geeft veel mogelijkheden voor zowel de ceremonie als het feest. Wil je een formele of juist een informele sfeer?",
      createdAt: event.createdAt,
    },
    { id: uid("msg"), eventId, role: "user", text: "Formeel diner, maar 's avonds mag het losser met een DJ en dansen.", createdAt: event.createdAt },
    {
      id: uid("msg"),
      eventId,
      role: "assistant",
      text: "Perfect beeld. Wat is ongeveer je totale budget voor deze bruiloft?",
      createdAt: event.createdAt,
    },
    { id: uid("msg"), eventId, role: "user", text: "Zo'n €25.000 in totaal.", createdAt: event.createdAt },
  ];

  const requirements: RequirementCategory[] = [
    req({ eventId, categoryKey: "venue", label: "Locatie", priority: "essential", estimatedBudgetCents: 550_000, status: "confirmed",
      aiRationale: "Bij 120 gasten met binnen- en buitenruimte is een geschikte locatie de eerste en belangrijkste bouwsteen — alle andere leveranciers plannen om deze keuze heen." }),
    req({ eventId, categoryKey: "planner", label: "Weddingplanner", priority: "recommended", estimatedBudgetCents: 300_000, status: "awaiting_response",
      aiRationale: "Bij een bruiloft van deze omvang en formaliteit voorkomt een coördinator op de dag zelf veel stress voor jullie en je gasten." }),
    req({ eventId, categoryKey: "catering", label: "Catering", priority: "essential", estimatedBudgetCents: 800_000, status: "confirmed",
      aiRationale: "Een formeel diner voor 120 gasten vraagt om volledige catering inclusief bediening." }),
    req({ eventId, categoryKey: "cake", label: "Bruidstaart", priority: "recommended", estimatedBudgetCents: 45_000, status: "offers_received",
      aiRationale: "Een bruidstaart is bij een formeel diner een verwacht onderdeel van het dessert." }),
    req({ eventId, categoryKey: "florist", label: "Bloemist", priority: "recommended", estimatedBudgetCents: 100_000, status: "offers_received",
      aiRationale: "Bloemstukken en een ceremonieboog passen bij de botanische, tijdloze stijl die je hebt aangegeven." }),
    req({ eventId, categoryKey: "decoration", label: "Decoratie", priority: "recommended", estimatedBudgetCents: 90_000, status: "offers_received",
      aiRationale: "Aanvullende styling versterkt het pastel-met-groen thema door de hele locatie heen." }),
    req({ eventId, categoryKey: "dj_music", label: "DJ / live muziek", priority: "essential", estimatedBudgetCents: 100_000, status: "confirmed",
      aiRationale: "Je gaf aan 's avonds te willen dansen — een DJ met eigen geluid is dan essentieel." }),
    req({ eventId, categoryKey: "photography", label: "Fotografie", priority: "essential", estimatedBudgetCents: 160_000, status: "confirmed",
      aiRationale: "Bij een bruiloft van deze schaal is professionele fotografie vrijwel altijd een prioriteit." }),
    req({ eventId, categoryKey: "videography", label: "Videografie", priority: "optional", estimatedBudgetCents: 140_000, status: "awaiting_response",
      aiRationale: "Een huwelijksfilm is een mooie aanvulling op de foto's, maar niet noodzakelijk." }),
    req({ eventId, categoryKey: "furniture_rental", label: "Stoelen & tafels", priority: "essential", estimatedBudgetCents: 90_000, status: "confirmed",
      aiRationale: "Voor 120 gasten binnen én buiten is aanvullend meubilair nodig naast wat de locatie standaard biedt." }),
    req({ eventId, categoryKey: "lighting_sound", label: "Licht & geluid", priority: "recommended", estimatedBudgetCents: 90_000, status: "awaiting_response",
      aiRationale: "Sfeerverlichting maakt het verschil tussen het diner en het feestgedeelte 's avonds." }),
    req({ eventId, categoryKey: "cleaning", label: "Schoonmaak", priority: "optional", estimatedBudgetCents: 35_000, status: "awaiting_response",
      aiRationale: "Bij gebruik van een externe locatie is eindschoonmaak vaak verplicht of sterk aan te raden." }),
  ];

  const requests: ServiceRequest[] = [];
  const offers: OfferOption[] = [];

  // Confirmed: venue
  const venueReq = request({ eventId, categoryKey: "venue", supplierIds: ["sup_venue_01", "sup_venue_02", "sup_venue_03"], desiredService: "Exclusieve huur, binnen & buiten", specialRequests: "Ruimte voor ceremonie én feestavond", budgetCents: 550_000, status: "responded", sentHoursAgo: 900 });
  requests.push(venueReq);
  const venueOfferAccepted = offer({ eventId, requestId: venueReq.id, categoryKey: "venue", supplierId: "sup_venue_01", totalPriceCents: 520_000, status: "accepted", swipeDecision: "shortlisted", includes: ["Exclusief gebruik villa & tuin", "Basis tafels en stoelen", "Parkeren"], matchScore: 96, matchRationale: "Sterke match omdat deze locatie beschikbaar is op 15 juni, binnen en buiten ruimte biedt en uitstekende beoordelingen heeft van vergelijkbare bruiloften.", respondedHoursAgo: 700 });
  offers.push(venueOfferAccepted);
  offers.push(offer({ eventId, requestId: venueReq.id, categoryKey: "venue", supplierId: "sup_venue_03", totalPriceCents: 690_000, status: "declined", swipeDecision: "rejected", includes: ["Exclusieve verhuur", "Bruidssuite"], matchScore: 89, matchRationale: "Premium match, maar prijs ligt boven het beschikbare budget voor deze categorie.", respondedHoursAgo: 650 }));

  // Confirmed: catering
  const cateringReq = request({ eventId, categoryKey: "catering", supplierIds: ["sup_catering_01", "sup_catering_02", "sup_catering_03"], desiredService: "Volledige catering, formeel diner", specialRequests: "Vegetarische en vegan opties voor circa 15% van de gasten", budgetCents: 800_000, status: "responded", sentHoursAgo: 600 });
  requests.push(cateringReq);
  offers.push(offer({ eventId, requestId: cateringReq.id, categoryKey: "catering", supplierId: "sup_catering_01", totalPriceCents: 500_000, status: "accepted", swipeDecision: "shortlisted", includes: ["3-gangen diner voor 120 gasten", "Bediening", "Vegetarische opties"], matchScore: 94, matchRationale: "Sterke match: ruime ervaring met bruiloften van vergelijkbare omvang en uitstekende beoordelingen.", respondedHoursAgo: 500 }));
  offers.push(offer({ eventId, requestId: cateringReq.id, categoryKey: "catering", supplierId: "sup_catering_03", totalPriceCents: 610_000, status: "declined", swipeDecision: "rejected", includes: ["Live cooking stations", "Premium menu"], matchScore: 85, matchRationale: "Goede match qua stijl, maar boven het gekozen prijsniveau.", respondedHoursAgo: 480 }));

  // Confirmed: photography
  const photoReq = request({ eventId, categoryKey: "photography", supplierIds: ["sup_photo_01", "sup_photo_02", "sup_photo_03"], desiredService: "Volledige dagverslaggeving", specialRequests: "Documentaire stijl, geen posed groepsfoto's", budgetCents: 160_000, status: "responded", sentHoursAgo: 400 });
  requests.push(photoReq);
  offers.push(offer({ eventId, requestId: photoReq.id, categoryKey: "photography", supplierId: "sup_photo_01", totalPriceCents: 145_000, status: "accepted", swipeDecision: "shortlisted", includes: ["10 uur aanwezigheid", "Online galerij", "Album"], matchScore: 97, matchRationale: "Sterke match: documentaire stijl precies zoals gevraagd, beschikbaar op 15 juni en uitstekende reviews.", respondedHoursAgo: 350 }));
  offers.push(offer({ eventId, requestId: photoReq.id, categoryKey: "photography", supplierId: "sup_photo_03", totalPriceCents: 92_000, status: "available", includes: ["6 uur aanwezigheid", "Digitale foto's"], matchScore: 78, matchRationale: "Budgetvriendelijke optie, maar minder ervaring met bruiloften van deze omvang.", respondedHoursAgo: 200 }));

  // Confirmed: dj_music
  const djReq = request({ eventId, categoryKey: "dj_music", supplierIds: ["sup_dj_01", "sup_dj_02"], desiredService: "DJ voor feestavond", specialRequests: "Open format, ook Turkse en internationale muziek", budgetCents: 100_000, status: "responded", sentHoursAgo: 300 });
  requests.push(djReq);
  offers.push(offer({ eventId, requestId: djReq.id, categoryKey: "dj_music", supplierId: "sup_dj_01", totalPriceCents: 95_000, status: "accepted", swipeDecision: "shortlisted", includes: ["DJ 6 uur", "Geluidsinstallatie", "Lichtshow"], matchScore: 93, matchRationale: "Sterke match: ruime ervaring met internationale bruiloften en beschikbaar op de gewenste datum.", respondedHoursAgo: 250 }));

  // Confirmed: furniture_rental
  const furnReq = request({ eventId, categoryKey: "furniture_rental", supplierIds: ["sup_furn_01", "sup_furn_02"], desiredService: "Extra stoelen, tafels en lounge-meubilair", specialRequests: "120 stoelen, loungehoek voor buiten", budgetCents: 90_000, status: "responded", sentHoursAgo: 250 });
  requests.push(furnReq);
  offers.push(offer({ eventId, requestId: furnReq.id, categoryKey: "furniture_rental", supplierId: "sup_furn_01", totalPriceCents: 90_000, status: "accepted", swipeDecision: "shortlisted", includes: ["120 stoelen", "Ronde tafels", "Levering & opbouw"], matchScore: 91, matchRationale: "Sterke match: grote voorraad, snelle levering en positieve ervaring bij vergelijkbare bruiloften.", respondedHoursAgo: 200 }));

  // Offers received, not yet decided: cake, florist, decoration
  const cakeReq = request({ eventId, categoryKey: "cake", supplierIds: ["sup_cake_01", "sup_cake_02"], desiredService: "Bruidstaart voor 120 gasten", specialRequests: "Eén laag glutenvrij", budgetCents: 45_000, status: "responded", sentHoursAgo: 60 });
  requests.push(cakeReq);
  offers.push(offer({ eventId, requestId: cakeReq.id, categoryKey: "cake", supplierId: "sup_cake_01", totalPriceCents: 45_000, status: "available", includes: ["3-laags taart", "1 laag glutenvrij", "Proeverij"], matchScore: 92, matchRationale: "Sterke match: gespecialiseerd in maatwerk en glutenvrije opties.", respondedHoursAgo: 40 }));
  offers.push(offer({ eventId, requestId: cakeReq.id, categoryKey: "cake", supplierId: "sup_cake_02", totalPriceCents: 32_000, status: "available", includes: ["3-laags taart klassiek"], matchScore: 80, matchRationale: "Goede prijs-kwaliteitverhouding, minder ervaring met glutenvrije taarten.", respondedHoursAgo: 30 }));

  const floristReq = request({ eventId, categoryKey: "florist", supplierIds: ["sup_florist_01", "sup_florist_02"], desiredService: "Bruidsboeket, tafelstukken en ceremonieboog", specialRequests: "Pastel met veel groen, botanisch", budgetCents: 100_000, status: "responded", sentHoursAgo: 55 });
  requests.push(floristReq);
  offers.push(offer({ eventId, requestId: floristReq.id, categoryKey: "florist", supplierId: "sup_florist_01", totalPriceCents: 95_000, status: "available", includes: ["Bruidsboeket", "12 tafelstukken", "Ceremonieboog"], matchScore: 95, matchRationale: "Sterke match: botanische stijl precies zoals gevraagd en eerdere ervaring op deze locatie.", respondedHoursAgo: 20 }));

  const decoReq = request({ eventId, categoryKey: "decoration", supplierIds: ["sup_deco_01"], desiredService: "Aanvullende styling ceremonie en diner", specialRequests: "Pastel met groen, subtiele candles", budgetCents: 90_000, status: "responded", sentHoursAgo: 50 });
  requests.push(decoReq);
  offers.push(offer({ eventId, requestId: decoReq.id, categoryKey: "decoration", supplierId: "sup_deco_01", totalPriceCents: 78_000, status: "available", includes: ["Tafelstyling", "Kaarsen", "Ceremonie-decor"], matchScore: 88, matchRationale: "Goede match qua stijl en ruime ervaring met bruiloften op vergelijkbare schaal.", respondedHoursAgo: 15 }));

  // Still awaiting response: planner, videography, lighting_sound, cleaning
  requests.push(request({ eventId, categoryKey: "planner", supplierIds: ["sup_planner_01"], desiredService: "Dagcoördinatie", specialRequests: "Coördinatie vanaf 10:00 op de trouwdag", budgetCents: 300_000, status: "awaiting_response", sentHoursAgo: 30 }));
  requests.push(request({ eventId, categoryKey: "videography", supplierIds: ["sup_video_01"], desiredService: "Huwelijksfilm", specialRequests: "Highlight-film van 5 minuten", budgetCents: 140_000, status: "awaiting_response", sentHoursAgo: 28 }));
  requests.push(request({ eventId, categoryKey: "lighting_sound", supplierIds: ["sup_light_01"], desiredService: "Sfeerverlichting binnen en buiten", specialRequests: "Uplighting in pastel tinten", budgetCents: 90_000, status: "awaiting_response", sentHoursAgo: 24 }));
  requests.push(request({ eventId, categoryKey: "cleaning", supplierIds: ["sup_clean_01"], desiredService: "Eindschoonmaak locatie", specialRequests: "Oplevering vóór 10:00 de volgende ochtend", budgetCents: 35_000, status: "awaiting_response", sentHoursAgo: 20 }));

  // Demo-boeking gebruikt het Starter-tarief (spec-item #53-vervolg,
  // SaaS-pivot) — een realistische venue-boeking van deze omvang zou allang
  // voorbij de proefperiode van een leverancier zijn.
  const demoCommission = calculateCommission(520_000, "starter");
  const payments: Payment[] = [
    {
      id: uid("pay"),
      eventId,
      offerId: venueOfferAccepted.id,
      categoryKey: "venue",
      supplierAmountCents: demoCommission.supplierAmount,
      platformFeeCents: demoCommission.platformFee,
      totalCents: demoCommission.total,
      commissionRate: demoCommission.rate,
      commissionTier: demoCommission.tier,
      status: "paid",
      createdAt: new Date(now.getTime() - 400 * 60 * 60 * 1000).toISOString(),
      paidAt: new Date(now.getTime() - 399 * 60 * 60 * 1000).toISOString(),
      provider: "mock",
      installment: "full",
      parentPaymentId: null,
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
      stripeTransferId: null,
      payoutStatus: "not_applicable",
      payoutReleasedAt: null,
    },
  ];

  const timeline: EventTimelineItem[] = [
    { id: uid("tl"), eventId, title: "Locatie vastleggen", dueDate: "2026-12-15", leadTimeLabel: "6 maanden vooraf", categoryKey: "venue", done: true, source: "ai_recommendation" },
    { id: uid("tl"), eventId, title: "Cateraar boeken", dueDate: "2027-02-15", leadTimeLabel: "4 maanden vooraf", categoryKey: "catering", done: true, source: "ai_recommendation" },
    { id: uid("tl"), eventId, title: "Fotograaf en DJ boeken", dueDate: "2027-03-15", leadTimeLabel: "3 maanden vooraf", categoryKey: "photography", done: true, source: "ai_recommendation" },
    { id: uid("tl"), eventId, title: "Bloemist en decoratie afronden", dueDate: "2027-04-15", leadTimeLabel: "2 maanden vooraf", categoryKey: "florist", done: false, source: "ai_recommendation" },
    { id: uid("tl"), eventId, title: "Definitief aantal gasten doorgeven aan alle leveranciers", dueDate: "2027-05-15", leadTimeLabel: "1 maand vooraf", categoryKey: null, done: false, source: "ai_recommendation" },
    { id: uid("tl"), eventId, title: "Laatste bevestigingen met alle leveranciers", dueDate: "2027-06-08", leadTimeLabel: "1 week vooraf", categoryKey: null, done: false, source: "ai_recommendation" },
    { id: uid("tl"), eventId, title: "Opbouw locatie", dueDate: "2027-06-14", leadTimeLabel: "1 dag vooraf", categoryKey: null, done: false, source: "ai_recommendation" },
  ];

  const tasks: EventTask[] = [
    { id: uid("task"), eventId, title: "Reageer op offerte bloemist voordat deze verloopt", urgency: "urgent", done: false, source: "ai_recommendation", relatedCategory: "florist" },
    { id: uid("task"), eventId, title: "Kies tussen de 2 ontvangen taart-offertes", urgency: "soon", done: false, source: "ai_recommendation", relatedCategory: "cake" },
    { id: uid("task"), eventId, title: "Herinner weddingplanner die nog niet gereageerd heeft", urgency: "soon", done: false, source: "ai_recommendation", relatedCategory: "planner" },
    { id: uid("task"), eventId, title: "Bevestig menu-opties met Taste Events", urgency: "normal", done: true, source: "user", relatedCategory: "catering" },
  ];

  const risks: RiskFlag[] = [
    { id: uid("risk"), eventId, severity: "warning", message: "Dit is een AI-signalering: je hebt nog geen back-upplan voor regen tijdens het buitengedeelte van de ceremonie.", createdAt: now.toISOString() },
    { id: uid("risk"), eventId, severity: "warning", message: "Dit is een AI-signalering: Videografie, Licht & geluid en Schoonmaak hebben nog niet gereageerd — de deadline van 48 uur nadert voor deze aanvragen.", createdAt: now.toISOString() },
  ];

  const messages: Message[] = [
    { id: uid("msg"), eventId, categoryKey: "catering", supplierId: "sup_catering_01", sender: "customer", text: "Is het dessert inbegrepen in de offerte, of moeten we dat los boeken bij de bakker?", attachments: [], createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString() },
    { id: uid("msg"), eventId, categoryKey: "catering", supplierId: "sup_catering_01", sender: "supplier", text: "Goede vraag! Dessert is inbegrepen in het menu, los van de bruidstaart. Extra bedienend personeel na 24:00 kost €350 in totaal.", attachments: [], createdAt: new Date(now.getTime() - 47 * 60 * 60 * 1000).toISOString() },
    { id: uid("msg"), eventId, categoryKey: "catering", supplierId: "sup_catering_01", sender: "ai_summary", text: "Samenvatting: de cateraar heeft bevestigd dat dessert is inbegrepen. Extra personeel na 24:00 kost €350. Laatste bevestiging van het menu voor 1 mei 2027.", attachments: [], createdAt: new Date(now.getTime() - 46 * 60 * 60 * 1000).toISOString() },
  ];

  return { event, interview, requirements, timeline, tasks, risks, requests, offers, payments, messages };
}

/* ==================================================================== */
/* DEMO EVENT 2 — Cem's 40ste verjaardag                                 */
/* ==================================================================== */

function buildBirthdayEvent(ownerId: string): EventBundle {
  const now = new Date();
  const eventDate = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const eventId = uid("event");

  const event: EventCore = {
    id: eventId,
    ownerId,
    name: "Cem's 40ste verjaardag",
    type: "birthday",
    stage: "sourcing",
    createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
    date: eventDate,
    monthHint: null,
    startTime: "17:00",
    endTime: "23:00",
    timezone: "Europe/Amsterdam",
    guestCountAdults: 50,
    guestCountChildren: 10,
    locationLabel: "Amsterdam",
    locationType: "home",
    indoorOutdoor: "outdoor",
    budget: { totalCents: 350_000, source: "user" },
    style: "Relaxed & gezellig, borrelsfeer",
    theme: null,
    formality: "casual",
    isProfessional: false,
    description: "Ik wil thuis een groot verjaardagsfeest geven voor mijn 40e verjaardag, met een man of 60 in de tuin.",
    notes: [],
  };

  const interview: AiInterviewMessage[] = [
    { id: uid("msg"), eventId, role: "user", text: event.description, createdAt: event.createdAt },
    { id: uid("msg"), eventId, role: "assistant", text: "Klinkt gezellig! Hoeveel mensen komen er ongeveer, en zijn daar kinderen bij?", createdAt: event.createdAt },
    { id: uid("msg"), eventId, role: "user", text: "Zo'n 50 volwassenen en 10 kinderen.", createdAt: event.createdAt },
    { id: uid("msg"), eventId, role: "assistant", text: "Fijn om te weten. Is het thuis, of zoek je een externe locatie?", createdAt: event.createdAt },
    { id: uid("msg"), eventId, role: "user", text: "Thuis, in de tuin.", createdAt: event.createdAt },
    { id: uid("msg"), eventId, role: "assistant", text: "Wil je catering, of ga je het zelf regelen met een borrelplank?", createdAt: event.createdAt },
    { id: uid("msg"), eventId, role: "user", text: "Graag catering, iets luchtigs met hapjes en BBQ.", createdAt: event.createdAt },
  ];

  const requirements: RequirementCategory[] = [
    req({ eventId, categoryKey: "catering", label: "Catering", priority: "essential", estimatedBudgetCents: 150_000, status: "offers_received",
      aiRationale: "Je gaf aan hapjes en BBQ te willen voor 60 gasten — dat vraagt om professionele catering." }),
    req({ eventId, categoryKey: "furniture_rental", label: "Stoelen & tafels", priority: "essential", estimatedBudgetCents: 45_000, status: "awaiting_response",
      aiRationale: "Voor 60 gasten in de tuin is extra zitgelegenheid nodig." }),
    req({ eventId, categoryKey: "dj_music", label: "DJ / muziek", priority: "recommended", estimatedBudgetCents: 60_000, status: "offers_received",
      aiRationale: "Bij een feest met deze sfeer maakt muziek en een goede geluidsinstallatie het verschil." }),
    req({ eventId, categoryKey: "decoration", label: "Decoratie", priority: "optional", estimatedBudgetCents: 25_000, status: "suggested",
      aiRationale: "Slingers en tuinverlichting versterken de feestsfeer, maar zijn niet noodzakelijk." }),
    req({ eventId, categoryKey: "cake", label: "Taart", priority: "recommended", estimatedBudgetCents: 15_000, status: "suggested",
      aiRationale: "Een verjaardagstaart is een vast onderdeel bij een 40e verjaardag." }),
    req({ eventId, categoryKey: "entertainment", label: "Kinderentertainment", priority: "recommended", estimatedBudgetCents: 20_000, status: "suggested",
      aiRationale: "Met 10 kinderen erbij houdt entertainment hen vermaakt terwijl de volwassenen genieten van het feest." }),
  ];

  const requests: ServiceRequest[] = [];
  const offers: OfferOption[] = [];

  const cateringReq = request({ eventId, categoryKey: "catering", supplierIds: ["sup_catering_02", "sup_catering_03"], desiredService: "BBQ met hapjes, walking dinner stijl", specialRequests: "Enkele vegetarische opties", budgetCents: 150_000, status: "responded", sentHoursAgo: 30 });
  requests.push(cateringReq);
  offers.push(offer({ eventId, requestId: cateringReq.id, categoryKey: "catering", supplierId: "sup_catering_02", totalPriceCents: 162_000, status: "available", includes: ["BBQ", "Hapjesplank", "Bediening 4 uur"], matchScore: 87, matchRationale: "Sterke match: ervaring met huisfeesten van vergelijkbare omvang en goede prijs-kwaliteit.", respondedHoursAgo: 10, extraCostsNote: "8% boven het opgegeven budget van €1.500." }));
  offers.push(offer({ eventId, requestId: cateringReq.id, categoryKey: "catering", supplierId: "sup_catering_03", totalPriceCents: 148_000, status: "available", includes: ["Live BBQ station", "Hapjes"], matchScore: 90, matchRationale: "Sterke match: live cooking past bij de gewenste informele sfeer en past binnen budget.", respondedHoursAgo: 6 }));

  const djReq = request({ eventId, categoryKey: "dj_music", supplierIds: ["sup_dj_02"], desiredService: "Achtergrondmuziek en feestset", specialRequests: "Familievriendelijk tot 21:00, daarna feestmuziek", budgetCents: 60_000, status: "responded", sentHoursAgo: 20 });
  requests.push(djReq);
  offers.push(offer({ eventId, requestId: djReq.id, categoryKey: "dj_music", supplierId: "sup_dj_02", totalPriceCents: 68_000, status: "available", includes: ["DJ 5 uur", "Geluidsset"], matchScore: 74, matchRationale: "Redelijke match; iets boven budget maar ruime ervaring met verjaardagsfeesten.", respondedHoursAgo: 3 }));

  requests.push(request({ eventId, categoryKey: "furniture_rental", supplierIds: ["sup_furn_01", "sup_furn_02"], desiredService: "Statafels, stoelen en partytent", specialRequests: "Partytent voor bij regen", budgetCents: 45_000, status: "awaiting_response", sentHoursAgo: 8 }));

  const payments: Payment[] = [];

  const timeline: EventTimelineItem[] = [
    { id: uid("tl"), eventId, title: "Catering vastleggen", dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), leadTimeLabel: "5 weken vooraf", categoryKey: "catering", done: false, source: "ai_recommendation" },
    { id: uid("tl"), eventId, title: "DJ en meubilair bevestigen", dueDate: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), leadTimeLabel: "4 weken vooraf", categoryKey: "dj_music", done: false, source: "ai_recommendation" },
    { id: uid("tl"), eventId, title: "Definitief aantal gasten doorgeven", dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), leadTimeLabel: "1 week vooraf", categoryKey: null, done: false, source: "ai_recommendation" },
  ];

  const tasks: EventTask[] = [
    { id: uid("task"), eventId, title: "Kies tussen de 2 cateringofferte's", urgency: "urgent", done: false, source: "ai_recommendation", relatedCategory: "catering" },
    { id: uid("task"), eventId, title: "Reageer op DJ-offerte (iets boven budget)", urgency: "soon", done: false, source: "ai_recommendation", relatedCategory: "dj_music" },
  ];

  const risks: RiskFlag[] = [
    { id: uid("risk"), eventId, severity: "warning", message: "Dit is een AI-signalering: je viert buiten in de tuin, maar er is nog geen partytent of overkapping geregeld voor bij regen.", createdAt: now.toISOString() },
    { id: uid("risk"), eventId, severity: "info", message: "Dit is een AI-signalering: de ontvangen cateringofferte van De Gastvrije Tafel ligt 8% boven je opgegeven budget voor deze categorie.", createdAt: now.toISOString() },
  ];

  const messages: Message[] = [];

  return { event, interview, requirements, timeline, tasks, risks, requests, offers, payments, messages };
}
