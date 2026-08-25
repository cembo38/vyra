import { describe, expect, it } from "vitest";
import { pickOfferAmountCents, mockParseOfferDescription, mockWriteOfferText } from "@/lib/ai/supplierOfferMock";

describe("pickOfferAmountCents", () => {
  it("kiest de eigen offerteprijs van de leverancier, niet het door de organisator genoemde budget (QA-bug, spec-item #57)", () => {
    const text = "46 euro voor 75 man? dat wordt 'm niet, daar kom je met catering echt niet uit. Ik denk dat je dan al snel uitkomt op zo'n 1500 tot 2000 euro totaal.";
    expect(pickOfferAmountCents(text)).toBe(200_000);
  });

  it("herkent een simpel eurobedrag met €-teken", () => {
    expect(pickOfferAmountCents("Voor €6.500 kan ik dit volledig verzorgen.")).toBe(650_000);
  });

  it("herkent een bedrag geschreven als '... euro'", () => {
    expect(pickOfferAmountCents("Dat kost in totaal 850 euro.")).toBe(85_000);
  });

  it("geeft null terug als er geen bedrag in de tekst staat", () => {
    expect(pickOfferAmountCents("Ik kan dit prima verzorgen, geen probleem.")).toBeNull();
  });

  it("negeert een expliciet 'budget van'-verwijzing ten gunste van de eigen offerte", () => {
    const text = "Bij een budget van 400 euro kom ik toch echt op een offerte van 900 euro uit.";
    expect(pickOfferAmountCents(text)).toBe(90_000);
  });
});

describe("mockParseOfferDescription", () => {
  it("detecteert bediening, levering en opbouw als aparte includes", () => {
    const result = mockParseOfferDescription("Inclusief bediening, levering en opbouw, voor €3.000 totaal.");
    expect(result.includes).toContain("Bediening / personeel");
    expect(result.includes).toContain("Levering");
    expect(result.includes).toContain("Opbouw");
    expect(result.totalPriceCents).toBe(300_000);
    expect(result.staffIncluded).toBe(true);
    expect(result.deliveryIncluded).toBe(true);
    expect(result.setupIncluded).toBe(true);
  });

  it("geeft lege includes en false-vlaggen bij een kale beschrijving zonder details", () => {
    const result = mockParseOfferDescription("Kan ik doen voor 500 euro.");
    expect(result.includes).toEqual([]);
    expect(result.staffIncluded).toBe(false);
    expect(result.deliveryIncluded).toBe(false);
    expect(result.setupIncluded).toBe(false);
  });
});

describe("mockWriteOfferText (Offertehulp, spec-item #57)", () => {
  it("verwerkt een herkend bedrag in de uitgeschreven tekst", () => {
    const text = mockWriteOfferText("catering 50p, €6500");
    expect(text).toMatch(/€\s?6\.500/);
  });

  it("noemt herkende insluitingen (bediening, levering) in de tekst", () => {
    const text = mockWriteOfferText("catering, incl bediening en levering, 4000");
    expect(text).toMatch(/bediening/i);
    expect(text).toMatch(/levering/i);
  });

  it("valt netjes terug op een generieke opening als er geen bedrag herkend wordt (geen 'null' of NaN in de tekst)", () => {
    const text = mockWriteOfferText("kan het wel doen, geen probleem");
    expect(text).not.toMatch(/null|NaN|undefined/i);
    expect(text.length).toBeGreaterThan(10);
  });

  it("geeft nooit een lege string terug voor niet-triviale invoer", () => {
    expect(mockWriteOfferText("dj, 3 uur, 500").length).toBeGreaterThan(0);
  });
});
