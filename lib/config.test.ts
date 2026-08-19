import { describe, expect, it } from "vitest";
import { calculateCommission, formatCurrency, PLATFORM_COMMISSION_RATE } from "@/lib/config";

/**
 * Geldberekeningen zijn de plek waar een bug het duurst is (verkeerd
 * uitbetaald bedrag aan een leverancier, of een verkeerde commissie voor
 * Vyra zelf) — vandaar dat dit als eerste een test krijgt.
 */
describe("calculateCommission", () => {
  it("berekent de platformfee als percentage van het leveranciersbedrag", () => {
    const result = calculateCommission(10000); // €100,00
    expect(result.supplierAmount).toBe(10000);
    expect(result.platformFee).toBe(Math.round(10000 * PLATFORM_COMMISSION_RATE));
    expect(result.total).toBe(result.supplierAmount + result.platformFee);
    expect(result.rate).toBe(PLATFORM_COMMISSION_RATE);
  });

  it("rondt de fee af op hele centen (geen halve centen in een uitbetaling)", () => {
    const result = calculateCommission(333); // een bedrag dat niet netjes deelt
    expect(Number.isInteger(result.platformFee)).toBe(true);
    expect(Number.isInteger(result.total)).toBe(true);
  });

  it("accepteert een afwijkend percentage (bv. voor toekomstige per-categorie commissie)", () => {
    const result = calculateCommission(10000, 0.2);
    expect(result.platformFee).toBe(2000);
    expect(result.total).toBe(12000);
    expect(result.rate).toBe(0.2);
  });

  it("geeft 0 fee bij 0 bedrag", () => {
    const result = calculateCommission(0);
    expect(result.platformFee).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe("formatCurrency", () => {
  it("formatteert centen als hele euro's, afgerond, in het Nederlands", () => {
    // Intl voegt een niet-brekende spatie ( ) tussen "€" en het bedrag in — vandaar de regex.
    expect(formatCurrency(150050)).toMatch(/^€\s?1\.501$/);
    expect(formatCurrency(0)).toMatch(/^€\s?0$/);
  });

  it("ondersteunt een andere valuta/locale", () => {
    expect(formatCurrency(150000, "USD", "en-US")).toBe("$1,500");
  });
});
