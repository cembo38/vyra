import { describe, expect, it } from "vitest";
import {
  calculateCommission,
  formatCurrency,
  COMMISSION_FEE_CAP_CENTS,
  INTRO_COMMISSION_RATE,
} from "@/lib/config";

/**
 * Geldberekeningen zijn de plek waar een bug het duurst is (verkeerd
 * uitbetaald bedrag aan een leverancier, of een verkeerde commissie voor
 * Vyra zelf) — vandaar dat dit als eerste een test krijgt. Dekt alle drie
 * de commissielagen uit het gelaagde model (spec-item #53): instap,
 * gestaffeld, en Pro.
 */
describe("calculateCommission", () => {
  describe("laag 1: intro", () => {
    it("berekent het vaste instaptarief over het volledige bedrag", () => {
      const result = calculateCommission(10000, "intro"); // €100,00
      expect(result.supplierAmount).toBe(10000);
      expect(result.platformFee).toBe(Math.round(10000 * INTRO_COMMISSION_RATE));
      expect(result.total).toBe(result.supplierAmount + result.platformFee);
      expect(result.rate).toBe(INTRO_COMMISSION_RATE);
      expect(result.tier).toBe("intro");
    });

    it("rondt de fee af op hele centen", () => {
      const result = calculateCommission(333, "intro");
      expect(Number.isInteger(result.platformFee)).toBe(true);
      expect(Number.isInteger(result.total)).toBe(true);
    });
  });

  describe("laag 2: tiered (gestaffeld, progressief zoals belastingschijven)", () => {
    it("gebruikt alleen de eerste schijf als het bedrag daarbinnen blijft", () => {
      const result = calculateCommission(10000, "tiered"); // €100 — ruim binnen de eerste schijf (€0–€500, 6%)
      expect(result.platformFee).toBe(Math.round(10000 * 0.06));
      expect(result.total).toBe(result.supplierAmount + result.platformFee);
      expect(result.tier).toBe("tiered");
    });

    it("verdeelt een bedrag dat meerdere schijven overspant, per schijf", () => {
      const result = calculateCommission(300_000, "tiered"); // €3.000
      // €0–€500 @ 6% = €30, €500–€2.000 @ 4,5% = €67,50, €2.000–€3.000 @ 3% = €30
      const expectedFee = Math.round(50_000 * 0.06 + 150_000 * 0.045 + 100_000 * 0.03);
      expect(result.platformFee).toBe(expectedFee);
      expect(result.total).toBe(300_000 + expectedFee);
      // Effectief (blended) percentage ligt tussen de laagste en hoogste toegepaste schijf in.
      expect(result.rate).toBeGreaterThan(0.03);
      expect(result.rate).toBeLessThan(0.06);
    });

    it("is nooit hoger dan het maximumbedrag per boeking (fee cap)", () => {
      const result = calculateCommission(5_000_000, "tiered"); // €50.000 — een grote boeking
      expect(result.platformFee).toBe(COMMISSION_FEE_CAP_CENTS);
      expect(result.total).toBe(5_000_000 + COMMISSION_FEE_CAP_CENTS);
    });

    it("is de standaardlaag als er geen tier wordt opgegeven", () => {
      const result = calculateCommission(10000);
      expect(result.tier).toBe("tiered");
    });

    it("rondt de fee af op hele centen (geen halve centen in een uitbetaling)", () => {
      const result = calculateCommission(333, "tiered");
      expect(Number.isInteger(result.platformFee)).toBe(true);
      expect(Number.isInteger(result.total)).toBe(true);
    });
  });

  describe("laag 3: pro (vast maandbedrag i.p.v. commissie)", () => {
    it("rekent geen platformkosten meer per boeking", () => {
      const result = calculateCommission(10000, "pro");
      expect(result.platformFee).toBe(0);
      expect(result.total).toBe(result.supplierAmount);
      expect(result.rate).toBe(0);
      expect(result.tier).toBe("pro");
    });
  });

  it("geeft 0 fee bij 0 bedrag, voor elke laag", () => {
    expect(calculateCommission(0, "intro").platformFee).toBe(0);
    expect(calculateCommission(0, "tiered").platformFee).toBe(0);
    expect(calculateCommission(0, "pro").platformFee).toBe(0);
  });
});

describe("formatCurrency", () => {
  it("formatteert centen als hele euro's, afgerond, in het Nederlands", () => {
    // Intl voegt een niet-brekende spatie ( ) tussen "€" en het bedrag in — vandaar de regex.
    expect(formatCurrency(150050)).toMatch(/^€\s?1\.501$/);
    expect(formatCurrency(0)).toMatch(/^€\s?0$/);
  });

  it("ondersteunt een andere valuta/locale", () => {
    expect(formatCurrency(150000, "USD", "en-US")).toBe("$1,500");
  });
});
