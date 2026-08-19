import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clamp, daysUntil, hoursUntil, initials, isValidKvkFormat, kvkLookupUrl } from "@/lib/utils";

describe("isValidKvkFormat", () => {
  it("accepteert precies 8 cijfers", () => {
    expect(isValidKvkFormat("12345678")).toBe(true);
  });

  it("wijst te kort, te lang, letters, en lege/ontbrekende waardes af", () => {
    expect(isValidKvkFormat("1234567")).toBe(false); // 7 cijfers
    expect(isValidKvkFormat("123456789")).toBe(false); // 9 cijfers
    expect(isValidKvkFormat("1234567a")).toBe(false); // letter erin
    expect(isValidKvkFormat("")).toBe(false);
    expect(isValidKvkFormat(null)).toBe(false);
    expect(isValidKvkFormat(undefined)).toBe(false);
  });

  it("negeert spaties aan begin/eind (kopieer-plak uit een ander document)", () => {
    expect(isValidKvkFormat("  12345678  ")).toBe(true);
  });
});

describe("kvkLookupUrl", () => {
  it("bouwt een geldige, url-encoded KVK-zoeklink", () => {
    const url = kvkLookupUrl("12345678");
    expect(url).toContain("kvknummer=12345678");
    expect(url.startsWith("https://www.kvk.nl/zoeken/")).toBe(true);
  });
});

describe("clamp", () => {
  it("houdt een waarde binnen de opgegeven grenzen", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("initials", () => {
  it("geeft de eerste letter van voor- en achternaam, in hoofdletters", () => {
    expect(initials("Cem", "Adiyaman")).toBe("CA");
    expect(initials("anna", "de vries")).toBe("AD");
  });

  it("gaat niet stuk bij een lege naam", () => {
    expect(initials("", "Adiyaman")).toBe("A");
    expect(initials("Cem", "")).toBe("C");
  });
});

describe("daysUntil / hoursUntil", () => {
  beforeEach(() => {
    // Vast "vandaag" zodat deze tests nooit afhangen van het moment
    // waarop ze toevallig draaien.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("daysUntil telt hele dagen tot een toekomstige datum", () => {
    expect(daysUntil("2026-06-20")).toBe(5);
  });

  it("daysUntil geeft een negatief getal voor een datum in het verleden", () => {
    expect(daysUntil("2026-06-10")).toBe(-5);
  });

  it("daysUntil geeft null als er geen datum is", () => {
    expect(daysUntil(null)).toBeNull();
  });

  it("hoursUntil telt uren tot een toekomstig tijdstip", () => {
    expect(hoursUntil("2026-06-15T18:00:00Z")).toBeCloseTo(6, 5);
  });
});
