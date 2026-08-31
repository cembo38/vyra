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
    const sum = (list: typeof withVenue) => list.filter((r) => r.priority !== "optional").reduce((s, r) => s + (r.estimatedBudgetCents ?? 0), 0);
    // Afronding per categorie kan een paar centen schelen, dus geen exacte gelijkheid.
    expect(Math.abs(sum(withoutVenue) - 100_000)).toBeLessThan(withoutVenue.length);
    expect(sum(withVenue)).toBeGreaterThan(0);
  });

  /**
   * HERONTWERP (gemeld door Cem, aug. 2026): "ik wil dat je het budget
   * enkel verdeeld over de essentiële en belangrijke zaken... de nice to
   * haves moet je geen budget geven totdat een gebruiker zelf aangeeft dit
   * in het plan mee te nemen" — bv. €1.000 → 200-200-500-100. Dit dekt
   * precies dat scenario met het "birthday"-sjabloon (catering 4, meubilair
   * 2, dj 2, taart 1 = essential+recommended-gewicht 9; decoratie 1,
   * photobooth 1 zijn "optional").
   */
  it("verdeelt het volledige budget alleen over essential/recommended; optional krijgt altijd €0", () => {
    const requirements = buildDefaultRequirements(baseEvent({ type: "birthday", budget: { totalCents: 100_000, source: "user" } }));
    const byKey = Object.fromEntries(requirements.map((r) => [r.categoryKey, r]));

    expect(byKey.catering.priority).toBe("essential");
    expect(byKey.catering.estimatedBudgetCents).toBe(44_444); // 4/9 van €1.000
    expect(byKey.furniture_rental.estimatedBudgetCents).toBe(22_222); // 2/9
    expect(byKey.dj_music.priority).toBe("recommended");
    expect(byKey.dj_music.estimatedBudgetCents).toBe(22_222); // 2/9
    expect(byKey.cake.estimatedBudgetCents).toBe(11_111); // 1/9

    expect(byKey.decoration.priority).toBe("optional");
    expect(byKey.decoration.estimatedBudgetCents).toBe(0);
    expect(byKey.photobooth.priority).toBe("optional");
    expect(byKey.photobooth.estimatedBudgetCents).toBe(0);

    // Essential+recommended benutten het budget vrijwel volledig (afronding: op zijn hoogst een paar centen eronder).
    const allocatableSum = requirements.filter((r) => r.priority !== "optional").reduce((s, r) => s + (r.estimatedBudgetCents ?? 0), 0);
    expect(allocatableSum).toBeLessThanOrEqual(100_000);
    expect(allocatableSum).toBeGreaterThan(99_990);
  });

  it("optional categorieën krijgen ook €0 zonder bekend totaalbudget (nooit de typische-marktprijs-fallback)", () => {
    const requirements = buildDefaultRequirements(baseEvent({ type: "birthday", budget: null }));
    const optional = requirements.filter((r) => r.priority === "optional");
    expect(optional.length).toBeGreaterThan(0);
    for (const r of optional) expect(r.estimatedBudgetCents).toBe(0);
  });
});

describe("capEstimatesToBudget", () => {
  const categories = [
    { key: "venue", priority: "essential" as const, selected: true, estimatedBudgetCents: 200_000 },
    { key: "catering", priority: "essential" as const, selected: true, estimatedBudgetCents: 150_000 },
    { key: "photography", priority: "recommended" as const, selected: true, estimatedBudgetCents: 90_000 },
    { key: "cake", priority: "recommended" as const, selected: false, estimatedBudgetCents: 40_000 }, // niet geselecteerd, telt niet mee in de som
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
    const withNull = [...categories, { key: "unknown", priority: "essential" as const, selected: true, estimatedBudgetCents: null }];
    const result = capEstimatesToBudget(withNull, 50_000);
    expect(result.find((c) => c.key === "unknown")!.estimatedBudgetCents).toBeNull();
  });

  it("optional categorieën tellen nooit mee in de som en worden nooit geschaald, zelfs niet als ze (foutief) toch een bedrag hebben", () => {
    const withOptional = [...categories, { key: "photobooth", priority: "optional" as const, selected: true, estimatedBudgetCents: 999_999 }];
    const result = capEstimatesToBudget(withOptional, 50_000);
    expect(result.find((c) => c.key === "photobooth")!.estimatedBudgetCents).toBe(999_999); // ongewijzigd, niet meegeschaald
    const selectedNonOptionalSum = result
      .filter((c) => c.selected && c.priority !== "optional")
      .reduce((s, c) => s + (c.estimatedBudgetCents ?? 0), 0);
    expect(selectedNonOptionalSum).toBeLessThanOrEqual(50_000);
  });
});
