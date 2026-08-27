import { describe, expect, it } from "vitest";
import { MAX_SANE_CATEGORY_CENTS, remainingCents, sanitizeItems, slideItem } from "@/lib/budget-allocator";

/**
 * De schuiven op de planpagina (BudgetAllocator.tsx, gemeld aug. 2026): dit
 * is de rekenlogica erachter, apart getest omdat een fout hier een
 * organisator een verkeerd verdeeld budget laat zien — precies het soort
 * bug dat aanleiding was voor deze hele feature (zie ook
 * lib/ai/catalog.test.ts). Herschreven (aug. 2026) samen met het
 * "envelope budgeting"-herontwerp — zie de toelichting bovenaan
 * lib/budget-allocator.ts voor waarom.
 */
const items = [
  { categoryId: "venue", label: "Locatie", cents: 20_000 },
  { categoryId: "catering", label: "Catering", cents: 15_000 },
  { categoryId: "photography", label: "Fotografie", cents: 15_000 },
];
const total = items.reduce((s, i) => s + i.cents, 0); // 50.000

describe("slideItem zonder vast totaalbudget", () => {
  it("verandert alleen de versleepte categorie, de rest blijft ongemoeid", () => {
    const result = slideItem(items, 0, 30_000, null);
    expect(result[0].cents).toBe(30_000);
    expect(result[1].cents).toBe(15_000);
    expect(result[2].cents).toBe(15_000);
  });

  it("klemt af op 0, nooit negatief", () => {
    const result = slideItem(items, 0, -500, null);
    expect(result[0].cents).toBe(0);
  });
});

describe("slideItem mét een vast totaalbudget (envelope-model)", () => {
  const totalBudget = 60_000; // 10.000 nog niet toegewezen t.o.v. de 50.000 hierboven

  it("verhogen haalt uit de 'nog te verdelen'-pot, andere categorieën blijven ongemoeid", () => {
    const result = slideItem(items, 0, 25_000, totalBudget); // +5.000, pot had 10.000
    expect(result[0].cents).toBe(25_000);
    expect(result[1].cents).toBe(15_000);
    expect(result[2].cents).toBe(15_000);
    expect(remainingCents(result, totalBudget)).toBe(5_000);
  });

  it("verlagen geeft terug aan de pot, andere categorieën blijven ongemoeid", () => {
    const result = slideItem(items, 0, 12_000, totalBudget); // -8.000
    expect(result[0].cents).toBe(12_000);
    expect(result[1].cents).toBe(15_000);
    expect(result[2].cents).toBe(15_000);
    expect(remainingCents(result, totalBudget)).toBe(18_000);
  });

  it("klemt een verhoging af op wat de pot daadwerkelijk heeft — andere categorieën blijven ongemoeid", () => {
    // pot heeft maar 10.000, "venue" probeert er 50.000 bij te vragen
    const result = slideItem(items, 0, 70_000, totalBudget);
    expect(result[0].cents).toBe(30_000); // 20.000 + de volledige pot (10.000), niet meer
    expect(result[1].cents).toBe(15_000);
    expect(result[2].cents).toBe(15_000);
    expect(remainingCents(result, totalBudget)).toBe(0);
  });

  it("kan niet verhogen als de pot al op 0 staat", () => {
    const fullyAllocated = 50_000; // exact gelijk aan de som hierboven
    const result = slideItem(items, 0, 30_000, fullyAllocated);
    expect(result[0].cents).toBe(20_000); // ongewijzigd: geen pot om uit te putten
  });

  it("laat de versleepte categorie zelf ook nooit negatief worden", () => {
    const result = slideItem(items, 0, -1000, totalBudget);
    expect(result[0].cents).toBe(0);
  });
});

describe("sanitizeItems", () => {
  it("klemt een absurd groot bedrag af op MAX_SANE_CATEGORY_CENTS", () => {
    const corrupted = [{ categoryId: "tent_rental", label: "Tentverhuur", cents: 46_728_576_851_286_940_000_000_000 }];
    const result = sanitizeItems(corrupted);
    expect(result[0].cents).toBe(MAX_SANE_CATEGORY_CENTS);
  });

  it("laat normale bedragen ongemoeid", () => {
    const result = sanitizeItems(items);
    expect(result).toEqual(items);
  });

  it("klemt ook negatieve bedragen af op 0", () => {
    const result = sanitizeItems([{ categoryId: "venue", label: "Locatie", cents: -500 }]);
    expect(result[0].cents).toBe(0);
  });
});

describe("slideItem klemt een corrupt groot bedrag af, ook tijdens het slepen zelf", () => {
  it("zonder vast totaalbudget: een absurde ruwe waarde van de browser wordt nooit toegepast", () => {
    const result = slideItem(items, 0, 46_728_576_851_286_940_000_000_000, null);
    expect(result[0].cents).toBe(MAX_SANE_CATEGORY_CENTS);
  });

  it("mét vast totaalbudget: een al-corrupt bedrag op de gesleepte categorie wordt teruggebracht naar wat er ingetypt/gesleept werd", () => {
    const corrupted = [
      { categoryId: "venue", label: "Locatie", cents: 46_728_576_851_286_940_000_000_000 },
      { categoryId: "catering", label: "Catering", cents: 15_000 },
    ];
    const result = slideItem(corrupted, 0, 20_000, 60_000);
    expect(result[0].cents).toBe(20_000);
    expect(result[1].cents).toBe(15_000); // de andere categorie blijft ongemoeid
  });
});

describe("remainingCents", () => {
  it("is null zonder vast totaalbudget", () => {
    expect(remainingCents(items, null)).toBeNull();
    expect(remainingCents(items, 0)).toBeNull();
  });

  it("is het totaalbudget min de som van alle categorieën, kan negatief zijn", () => {
    expect(remainingCents(items, 60_000)).toBe(10_000);
    expect(remainingCents(items, 40_000)).toBe(-10_000);
  });

  it("blijft consistent met total (som van items) als sanity-check", () => {
    expect(remainingCents(items, total)).toBe(0);
  });
});
