import { describe, expect, it } from "vitest";
import {
  serializeSupplierContext,
  mockSupplierAssistantAnswer,
  mockSupplierReplyDraft,
  mockSupplierBriefing,
  buildSupplierPriceAdvice,
  SupplierAssistantContext,
} from "@/lib/ai/supplierAssistantMock";
import { SupplierAccount, SupplierLead, SupplierOrder } from "@/lib/types";

/**
 * Dit is het codepad dat in DEZE sandbox (geen ANTHROPIC_API_KEY) bij élke
 * VyrAI-assistent-aanroep daadwerkelijk draait, en in productie bij elke
 * mislukte AI-aanroep — precies waar Cem op wees ("we willen geen
 * ondernemers die niks voor hun geld krijgen"): als dít pad een gek of leeg
 * antwoord geeft, merkt een betalende Pro/Premium-leverancier dat direct.
 * Zelfde motivatie/aanpak als lib/ai/catalog.test.ts.
 *
 * De geneste event/offer/payment-fixtures hieronder gebruiken bewust
 * `as unknown as T` — alleen de velden die de geteste functies daadwerkelijk
 * lezen (categorie, datum, naam, bedrag) zijn ingevuld; dit test de
 * mock-logica, geen volledigheid van de fixtures.
 */

function baseSupplier(overrides: Partial<SupplierAccount> = {}): SupplierAccount {
  return {
    id: "sup_1",
    ownerId: "user_1",
    companyName: "Feest & Zo",
    contactPerson: "Anna",
    category: "catering",
    categories: ["catering"],
    categoryOther: null,
    serviceAreas: ["Utrecht"],
    baseLocation: "Utrecht",
    serviceRadiusKm: 50,
    description: "Catering voor elk feest.",
    minPriceCents: 50_000,
    avgPriceCents: 80_000,
    ratingAvg: 4.5,
    ratingCount: 12,
    verified: true,
    verificationRequestedAt: null,
    avgResponseHours: 6,
    acceptedOfferRate: 0,
    tags: [],
    yearsActive: 3,
    portfolioHighlights: [],
    kvkNumber: null,
    website: null,
    socialFacebook: null,
    socialInstagram: null,
    socialTiktok: null,
    logoUrl: null,
    galleryUrls: [],
    subscriptionTier: "pro",
    storeOpen: true,
    packages: [],
    tagline: null,
    coverPhotoUrl: null,
    introVideoUrl: null,
    lat: null,
    lng: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseCtx(overrides: Partial<SupplierAssistantContext> = {}): SupplierAssistantContext {
  return {
    supplier: baseSupplier(),
    leads: [],
    orders: [],
    earnings: { paidCents: 0, pendingCents: 0, openLeadsCount: 0, activeOrdersCount: 0, upcomingThisMonthCount: 0 },
    insights: {
      avgResponseHours: 6,
      ratingAvg: 4.5,
      ratingCount: 12,
      categoryAvgResponseHours: 10,
      categoryAvgRating: 4.2,
      categoryPeerCount: 5,
      avgPriceCents: 80_000,
      categoryAvgPriceCents: 75_000,
    },
    ...overrides,
  };
}

function makeLead(overrides: { status?: "pending" | "responded" | "expired"; deadlineAt?: string; eventName?: string } = {}): SupplierLead {
  return {
    target: { id: "t1", requestId: "req_1", supplierId: "sup_1", status: overrides.status ?? "pending", createdAt: "2026-08-01T00:00:00.000Z" },
    request: {
      id: "req_1",
      eventId: "evt_1",
      categoryKey: "catering",
      supplierIds: ["sup_1"],
      desiredService: "Catering voor 50 gasten",
      specialRequests: "",
      budgetCents: 100_000,
      status: "sent",
      sentAt: "2026-08-01T00:00:00.000Z",
      deadlineAt: overrides.deadlineAt ?? "2026-08-30T00:00:00.000Z",
      targetSupplierId: null,
      isDirect: false,
    },
    event: {
      id: "evt_1",
      name: overrides.eventName ?? "Verjaardag Sanne",
      date: "2026-09-15",
    } as unknown as SupplierLead["event"],
  };
}

function makeOrder(overrides: { eventDate?: string | null; totalPriceCents?: number } = {}): SupplierOrder {
  return {
    offer: {
      id: "off_1",
      categoryKey: "catering",
      totalPriceCents: overrides.totalPriceCents ?? 120_000,
    } as unknown as SupplierOrder["offer"],
    event: overrides.eventDate === null ? null : ({ id: "evt_1", name: "Bedrijfsfeest", date: overrides.eventDate ?? "2026-10-01" } as unknown as SupplierOrder["event"]),
    payment: null,
  };
}

describe("serializeSupplierContext", () => {
  it("neemt alleen nog-openstaande (pending) leads mee, geen al beantwoorde", () => {
    const ctx = baseCtx({ leads: [makeLead({ status: "pending" }), makeLead({ status: "responded" })] });
    const parsed = JSON.parse(serializeSupplierContext(ctx));
    expect(parsed.openAanvragen).toHaveLength(1);
  });

  it("laat verlopen (in het verleden gedateerde) boekingen weg uit aankomendeBoekingen", () => {
    const ctx = baseCtx({ orders: [makeOrder({ eventDate: "2020-01-01" }), makeOrder({ eventDate: "2099-01-01" })] });
    const parsed = JSON.parse(serializeSupplierContext(ctx));
    expect(parsed.aankomendeBoekingen).toHaveLength(1);
  });

  it("geeft geldig JSON terug (geen crash bij lege context)", () => {
    expect(() => JSON.parse(serializeSupplierContext(baseCtx()))).not.toThrow();
  });
});

describe("mockSupplierAssistantAnswer", () => {
  it("meldt correct dat er geen openstaande aanvragen zijn", () => {
    const answer = mockSupplierAssistantAnswer("Welke aanvragen wachten nog op mij?", baseCtx());
    expect(answer).toMatch(/geen openstaande aanvragen/i);
  });

  it("noemt de meest urgente (eerst verlopende) lead, niet zomaar de eerste in de lijst", () => {
    const laat = makeLead({ deadlineAt: "2026-12-01T00:00:00.000Z", eventName: "Laat feest" });
    const vroeg = makeLead({ deadlineAt: "2026-08-20T00:00:00.000Z", eventName: "Urgent feest" });
    const answer = mockSupplierAssistantAnswer("Welke aanvragen wachten nog op mij?", baseCtx({ leads: [laat, vroeg] }));
    expect(answer).toContain("Urgent feest");
    expect(answer).not.toContain("Laat feest");
  });

  it("beantwoordt een verdiensten-vraag met de juiste bedragen", () => {
    const answer = mockSupplierAssistantAnswer(
      "Hoeveel heb ik al verdiend?",
      baseCtx({ earnings: { paidCents: 250_000, pendingCents: 50_000, openLeadsCount: 0, activeOrdersCount: 2, upcomingThisMonthCount: 1 } })
    );
    // formatCurrency (Intl.NumberFormat nl-NL) zet een non-breaking space
    // tussen "€" en het bedrag — vandaar \s (niet een letterlijke spatie).
    expect(answer).toMatch(/€\s?2\.500/);
    expect(answer).toMatch(/€\s?500/);
  });

  it("vergelijkt reactiesnelheid correct tegen het categoriegemiddelde (sneller)", () => {
    const answer = mockSupplierAssistantAnswer(
      "Hoe is mijn reactiesnelheid?",
      baseCtx({ insights: { avgResponseHours: 3, ratingAvg: 4.8, ratingCount: 5, categoryAvgResponseHours: 10, categoryAvgRating: 4, categoryPeerCount: 3, avgPriceCents: 80_000, categoryAvgPriceCents: 75_000 } })
    );
    expect(answer).toMatch(/sneller dan het categoriegemiddelde/);
  });

  it("vergelijkt reactiesnelheid correct tegen het categoriegemiddelde (trager)", () => {
    const answer = mockSupplierAssistantAnswer(
      "Wat is mijn reactietijd?",
      baseCtx({ insights: { avgResponseHours: 20, ratingAvg: 4.8, ratingCount: 5, categoryAvgResponseHours: 10, categoryAvgRating: 4, categoryPeerCount: 3, avgPriceCents: 80_000, categoryAvgPriceCents: 75_000 } })
    );
    expect(answer).toMatch(/trager dan het categoriegemiddelde/);
  });

  it("valt netjes terug op 'geen beoordelingen' als ratingCount 0 is (geen NaN of crash)", () => {
    const answer = mockSupplierAssistantAnswer(
      "Wat is mijn beoordeling?",
      baseCtx({ insights: { avgResponseHours: 5, ratingAvg: 0, ratingCount: 0, categoryAvgResponseHours: null, categoryAvgRating: null, categoryPeerCount: 0, avgPriceCents: 80_000, categoryAvgPriceCents: null } })
    );
    expect(answer).toMatch(/nog geen beoordelingen/);
    expect(answer).not.toMatch(/NaN/);
  });

  it("noemt het juiste aantal aankomende boekingen bij een planning-vraag", () => {
    const ver = makeOrder({ eventDate: "2026-12-25" });
    const dichtbij = makeOrder({ eventDate: "2026-09-01" });
    const answer = mockSupplierAssistantAnswer("Wat komt er deze maand aan?", baseCtx({ orders: [ver, dichtbij] }));
    expect(answer).toMatch(/2 aankomende boeking/);
  });

  it("geeft een zinnig fallback-antwoord op een onherkende vraag (nooit leeg)", () => {
    const answer = mockSupplierAssistantAnswer("Wat is de zin van het leven?", baseCtx());
    expect(answer.length).toBeGreaterThan(10);
  });
});

describe("mockSupplierReplyDraft", () => {
  it("verwerkt categorie en eventnaam in het concept", () => {
    const draft = mockSupplierReplyDraft("Catering", "Verjaardag Sanne");
    expect(draft).toContain("Catering");
    expect(draft).toContain("Verjaardag Sanne");
  });

  it("werkt ook zonder bekende eventnaam (geen 'null' in de tekst)", () => {
    const draft = mockSupplierReplyDraft("DJ", null);
    expect(draft).not.toContain("null");
  });
});

describe("mockSupplierBriefing", () => {
  it("geeft een gerust briefje terug bij geen signalen", () => {
    expect(mockSupplierBriefing([])).toMatch(/geen urgente zaken/i);
  });

  it("noemt het eerste signaal en het aantal overige bij meerdere signalen", () => {
    const narrative = mockSupplierBriefing(["Lead X verloopt over 2 uur", "Gesprek Y ligt al 5 dagen stil", "Boeking Z komt eraan"]);
    expect(narrative).toContain("Lead X verloopt over 2 uur");
    expect(narrative).toMatch(/nog 2 andere punten/);
  });

  it("gebruikt enkelvoud bij precies één overig signaal", () => {
    const narrative = mockSupplierBriefing(["Signaal A", "Signaal B"]);
    expect(narrative).toMatch(/nog 1 ander punt\)/);
  });
});

describe("buildSupplierPriceAdvice", () => {
  it("meldt dat er nog niet genoeg vergelijkingsmateriaal is als het categoriegemiddelde null is", () => {
    expect(buildSupplierPriceAdvice(50_000, null)).toMatch(/nog niet genoeg/i);
  });

  it("meldt dat er nog niet genoeg vergelijkingsmateriaal is als het categoriegemiddelde 0 is", () => {
    expect(buildSupplierPriceAdvice(50_000, 0)).toMatch(/nog niet genoeg/i);
  });

  it("signaleert een prijs die duidelijk (>=15%) boven het categoriegemiddelde ligt", () => {
    const advice = buildSupplierPriceAdvice(120_000, 100_000); // +20%
    expect(advice).toMatch(/20% boven/);
  });

  it("signaleert een prijs die duidelijk (>=15%) onder het categoriegemiddelde ligt", () => {
    const advice = buildSupplierPriceAdvice(80_000, 100_000); // -20%
    expect(advice).toMatch(/20% onder/);
    expect(advice).not.toContain("-20%");
  });

  it("beschouwt een klein verschil (<15%) als 'dicht bij het gemiddelde', geen boven/onder-advies", () => {
    const advice = buildSupplierPriceAdvice(105_000, 100_000); // +5%
    expect(advice).toMatch(/dicht bij het categoriegemiddelde/);
  });

  it("hanteert de grens bij exact 15% als 'boven', niet als 'dicht bij'", () => {
    const advice = buildSupplierPriceAdvice(115_000, 100_000); // +15%
    expect(advice).toMatch(/15% boven/);
  });
});
