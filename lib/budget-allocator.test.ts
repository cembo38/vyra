import { describe, expect, it } from "vitest";
import { redistributeSlide } from "@/lib/budget-allocator";

/**
 * De schuiven op de planpagina (BudgetAllocator.tsx, gemeld aug. 2026): dit
 * is de rekenlogica erachter, apart getest omdat een fout hier een
 * organisator een verkeerd verdeeld budget laat zien — precies het soort
 * bug dat aanleiding was voor deze hele feature (zie ook
 * lib/ai/catalog.test.ts).
 */
const items = [
  { categoryId: "venue", label: "Locatie", cents: 20_000 },
  { categoryId: "catering", label: "Catering", cents: 15_000 },
  { categoryId: "photography", label: "Fotografie", cents: 15_000 },
];
const total = items.reduce((s, i) => s + i.cents, 0); // 50.000

describe("redistributeSlide zonder vast totaalbudget", () => {
  it("verandert alleen de versleepte categorie, de rest blijft ongemoeid", () => {
    const result = redistributeSlide(items, 0, 30_000, false);
    expect(result[0].cents).toBe(30_000);
    expect(result[1].cents).toBe(15_000);
    expect(result[2].cents).toBe(15_000);
  });

  it("klemt af op 0, nooit negatief", () => {
    const result = redistributeSlide(items, 0, -500, false);
    expect(result[0].cents).toBe(0);
  });
});

describe("redistributeSlide mét een vast totaalbudget", () => {
  it("houdt de som na het verhogen van één schuif exact gelijk aan het totaal ervoor", () => {
    const result = redistributeSlide(items, 0, 30_000, true);
    const sum = result.reduce((s, i) => s + i.cents, 0);
    expect(sum).toBe(total);
    expect(result[0].cents).toBe(30_000);
  });

  it("houdt de som na het verlagen van één schuif ook exact gelijk aan het totaal ervoor", () => {
    const result = redistributeSlide(items, 0, 10_000, true);
    const sum = result.reduce((s, i) => s + i.cents, 0);
    expect(sum).toBe(total);
    expect(result[0].cents).toBe(10_000);
  });

  it("verdeelt de verandering naar verhouding over de andere categorieën (gelijke categorieën krijgen een gelijke aanpassing)", () => {
    const result = redistributeSlide(items, 0, 30_000, true); // +10.000 opgeëist bij "venue"
    // catering en photography stonden allebei op 15.000 (gelijke verhouding), dus verliezen ze allebei evenveel.
    expect(result[1].cents).toBe(result[2].cents);
    expect(result[1].cents).toBe(10_000);
  });

  it("kan nooit meer opeisen dan de andere categorieën samen nog hebben — klemt de schuif zelf af", () => {
    // "venue" probeert naar 100.000 te gaan, terwijl de rest samen maar 30.000 heeft.
    const result = redistributeSlide(items, 0, 100_000, true);
    const sum = result.reduce((s, i) => s + i.cents, 0);
    expect(sum).toBe(total);
    expect(result[0].cents).toBe(50_000); // 20.000 + alles wat de rest kon missen (30.000)
    expect(result[1].cents).toBe(0);
    expect(result[2].cents).toBe(0);
  });

  it("verdeelt vrijgekomen budget gelijk als alle andere categorieën al op €0 stonden", () => {
    const zeroed = [
      { categoryId: "venue", label: "Locatie", cents: 50_000 },
      { categoryId: "catering", label: "Catering", cents: 0 },
      { categoryId: "photography", label: "Fotografie", cents: 0 },
    ];
    const result = redistributeSlide(zeroed, 0, 20_000, true); // venue levert 30.000 in
    const sum = result.reduce((s, i) => s + i.cents, 0);
    expect(sum).toBe(50_000);
    expect(result[0].cents).toBe(20_000);
    expect(result[1].cents).toBe(15_000);
    expect(result[2].cents).toBe(15_000);
  });

  it("laat geen enkele categorie negatief worden", () => {
    const result = redistributeSlide(items, 0, 45_000, true);
    for (const it of result) expect(it.cents).toBeGreaterThanOrEqual(0);
  });
});
