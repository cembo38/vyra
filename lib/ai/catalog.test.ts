import { describe, expect, it } from "vitest";
import { buildDefaultRequirements, capEstimatesToBudget } from "@/lib/ai/catalog";
import { EventCore } from "@/lib/types";

/**
 * Dekt de budget/locatie-bug die Cem meldde (aug. 2026): een organisator met
 * een budget van €500 kreeg een AI-plan van ruim €4.400, en "binnenshuis"
 * leidde alsnog tot een voorstel om een locatie te huren. Geldberekeningen
 * en budgetlogica zijn precies waar een bug het duurst is (zie
 * lib/config.test.ts) — vandaar dat deze twee losstaande, testbare functies
 * (geen "server-only", zie vitest.config.ts) er nu een test bij hebben.
 */
function baseEvent(overrides: Partial<EventCore> = {}): EventCore {
  return {
    id: "evt_1",
    ownerId: "user_1",
    name: "Verjaardagsfeest",
    type: "birthday",
    stage: "draft",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    date: null,
    monthHint: null,
    startTime: null,
    endTime: null,
    timezone: "Europe/Amsterdam",
    guestCountAdults: 30,
    guestCountChildren: null,
    locationLabel: "Amsterdam",
    locationType: null,
    indoorOutdoor: null,
    budget: null,
    style: null,
    theme: null,
    formality: null,
    isProfessional: false,
    description: "Verjaardagsfeest",
    notes: [],
    ...overrides,
  };
}

describe("buildDefaultRequirements", () => {
  it("stelt 'venue' voor als de locatie nog niet bekend is", () => {
    const requirements = buildDefaultRequirements(baseEvent({ type: "wedding" }));
    expect(requirements.some((r) => r.categoryKey === "venue")).toBe(true);
  });

  it("stelt GEEN 'venue' meer voor zodra de organisator al aangaf het thuis te doen", () => {
    const requirements = buildDefaultRequirements(baseEvent({ type: "wedding", locationType: "home" }));
    expect(requirements.some((r) => r.categoryKey === "venue")).toBe(false);
  });

  it("verdeelt een bekend totaalbudget nog steeds volledig over de resterende categorieën na het weglaten van 'venue'", () => {
    const withVenue = buildDefaultRequirements(baseEvent({ type: "wedding", budget: { totalCents: 100_000, source: "user" } }));
    const withoutVenue = buildDefaultRequirements(baseEvent({ type: "wedding", locationType: "home", budget: { totalCents: 100_000, source: "user" } }));
    const sum = (list: typeof withVenue) => list.reduce((s, r) => s + (r.estimatedBudgetCents ?? 0), 0);
    // Afronding per categorie kan een paar centen schelen, dus geen exacte gelijkheid.
    expect(Math.abs(sum(withoutVenue) - 100_000)).toBeLessThan(withoutVenue.length);
    expect(sum(withVenue)).toBeGreaterThan(0);
  });
});

describe("capEstimatesToBudget", () => {
  const categories = [
    { key: "venue", selected: true, estimatedBudgetCents: 200_000 },
    { key: "catering", selected: true, estimatedBudgetCents: 150_000 },
    { key: "photography", selected: true, estimatedBudgetCents: 90_000 },
    { key: "cake", selected: false, estimatedBudgetCents: 40_000 }, // niet geselecteerd, telt niet mee in de som
  ];

  it("schaalt alle schattingen naar verhouding omlaag als de AI het budget fors overschrijdt (het gemelde €500-vs-€4.400-geval)", () => {
    // 200.000 + 150.000 + 90.000 = 440.000 centen (€4.400) voorgesteld, terwijl het budget maar 50.000 centen (€500) is.
    const result = capEstimatesToBudget(categories, 50_000);
    const selectedSum = result.filter((c) => c.selected).reduce((s, c) => s + (c.estimatedBudgetCents ?? 0), 0);
    expect(selectedSum).toBeLessThanOrEqual(50_000);
    expect(selectedSum).toBeGreaterThan(49_000); // moet het budget ook niet onnodig ver onderschieten
    // Verhoudingen tussen categorieën blijven behouden na het schalen.
    const venue = result.find((c) => c.key === "venue")!;
    const catering = result.find((c) => c.key === "catering")!;
    expect(venue.estimatedBudgetCents! / catering.estimatedBudgetCents!).toBeCloseTo(200_000 / 150_000, 2);
  });

  it("laat de schattingen ongemoeid als de AI toevallig al binnen budget blijft", () => {
    const result = capEstimatesToBudget(categories, 1_000_000);
    expect(result).toEqual(categories);
  });

  it("doet niets als er geen totaalbudget bekend is", () => {
    expect(capEstimatesToBudget(categories, null)).toEqual(categories);
    expect(capEstimatesToBudget(categories, undefined)).toEqual(categories);
  });

  it("laat 'null'-schattingen met rust (kan niet naar verhouding geschaald worden)", () => {
    const withNull = [...categories, { key: "unknown", selected: true, estimatedBudgetCents: null }];
    const result = capEstimatesToBudget(withNull, 50_000);
    expect(result.find((c) => c.key === "unknown")!.estimatedBudgetCents).toBeNull();
  });
});
