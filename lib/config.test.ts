import { describe, expect, it } from "vitest";
import {
  calculateCommission,
  formatCurrency,
  COMMISSION_FEE_CAP_CENTS,
  SUBSCRIPTION_TIERS,
  TRIAL_TIER_DEFINITION,
} from "@/lib/config";

/**
 * Geldberekeningen zijn de plek waar een bug het duurst is (verkeerd
 * uitbetaald bedrag aan een leverancier, of een verkeerde commissie voor
 * Vyra zelf) — vandaar dat dit als eerste een test krijgt. Dekt het
 * abonnementenmodel (spec-item #53, SaaS-pivot): de proefperiode en alle
 * vijf abonnementsniveaus.
 */
describe("calculateCommission", () => {
  describe("proefperiode ('trial')", () => {
    it("rekent geen platformkosten tijdens de proefperiode", () => {
      const result = calculateCommission(10000, "trial");
      expect(result.supplierAmount).toBe(10000);
      expect(result.platformFee).toBe(0);
      expect(result.total).toBe(10000);
      expect(result.rate).toBe(0);
      expect(result.tier).toBe("trial");
    });

    it("gebruikt dezelfde 0%-schijf als TRIAL_TIER_DEFINITION beschrijft", () => {
      expect(TRIAL_TIER_DEFINITION.commissionTiers).toEqual([{ uptoCents: null, rate: 0 }]);
    });
  });

  describe("Starter (gestaffeld, progressief zoals belastingschijven)", () => {
    it("gebruikt alleen de eerste schijf als het bedrag daarbinnen blijft", () => {
      const result = calculateCommission(10000, "starter"); // €100 — ruim binnen de eerste schijf (€0–€500, 6%)
      expect(result.platformFee).toBe(Math.round(10000 * 0.06));
      expect(result.total).toBe(result.supplierAmount + result.platformFee);
      expect(result.tier).toBe("starter");
    });

    it("verdeelt een bedrag dat meerdere schijven overspant, per schijf", () => {
      const result = calculateCommission(300_000, "starter"); // €3.000
      // €0–€500 @ 6% = €30, €500–€2.000 @ 4,5% = €67,50, €2.000–€3.000 @ 3% = €30
      const expectedFee = Math.round(50_000 * 0.06 + 150_000 * 0.045 + 100_000 * 0.03);
      expect(result.platformFee).toBe(expectedFee);
      expect(result.total).toBe(300_000 + expectedFee);
      // Effectief (blended) percentage ligt tussen de laagste en hoogste toegepaste schijf in.
      expect(result.rate).toBeGreaterThan(0.03);
      expect(result.rate).toBeLessThan(0.06);
    });

    it("is nooit hoger dan het maximumbedrag per boeking (fee cap)", () => {
      const result = calculateCommission(5_000_000, "starter"); // €50.000 — een grote boeking
      expect(result.platformFee).toBe(COMMISSION_FEE_CAP_CENTS);
      expect(result.total).toBe(5_000_000 + COMMISSION_FEE_CAP_CENTS);
    });

    it("is de standaardlaag als er geen tier wordt opgegeven", () => {
      const result = calculateCommission(10000);
      expect(result.tier).toBe("starter");
    });

    it("rondt de fee af op hele centen (geen halve centen in een uitbetaling)", () => {
      const result = calculateCommission(333, "starter");
      expect(Number.isInteger(result.platformFee)).toBe(true);
      expect(Number.isInteger(result.total)).toBe(true);
    });
  });

  describe("Groei (verlaagd gestaffeld tarief)", () => {
    it("rekent een lager percentage dan Starter over hetzelfde bedrag", () => {
      const starter = calculateCommission(10000, "starter");
      const groei = calculateCommission(10000, "groei");
      expect(groei.platformFee).toBeLessThan(starter.platformFee);
      expect(groei.tier).toBe("groei");
    });
  });

  describe("Pro/Premium/Enterprise (0% commissie, vast maandbedrag i.p.v. per boeking)", () => {
    it.each(["pro", "premium", "enterprise"] as const)("rekent geen platformkosten meer per boeking (%s)", (tier) => {
      const result = calculateCommission(10000, tier);
      expect(result.platformFee).toBe(0);
      expect(result.total).toBe(result.supplierAmount);
      expect(result.rate).toBe(0);
      expect(result.tier).toBe(tier);
    });
  });

  it("geeft 0 fee bij 0 bedrag, voor elke laag", () => {
    expect(calculateCommission(0, "trial").platformFee).toBe(0);
    expect(calculateCommission(0, "starter").platformFee).toBe(0);
    expect(calculateCommission(0, "groei").platformFee).toBe(0);
    expect(calculateCommission(0, "pro").platformFee).toBe(0);
  });
});

describe("SUBSCRIPTION_TIERS", () => {
  it("heeft een oplopende prijs voor Starter t/m Premium (Enterprise is op maat, dus null)", () => {
    expect(SUBSCRIPTION_TIERS.starter.priceCents).toBeLessThan(SUBSCRIPTION_TIERS.groei.priceCents!);
    expect(SUBSCRIPTION_TIERS.groei.priceCents).toBeLessThan(SUBSCRIPTION_TIERS.pro.priceCents!);
    expect(SUBSCRIPTION_TIERS.pro.priceCents).toBeLessThan(SUBSCRIPTION_TIERS.premium.priceCents!);
    expect(SUBSCRIPTION_TIERS.enterprise.priceCents).toBeNull();
  });

  it("begint niet lager dan €49/maand voor het goedkoopste betaalde niveau", () => {
    expect(SUBSCRIPTION_TIERS.starter.priceCents).toBe(4_900);
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
