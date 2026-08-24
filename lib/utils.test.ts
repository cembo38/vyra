import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clamp, daysUntil, getVideoEmbedUrl, hoursUntil, initials, isReviewRevealed, isValidKvkFormat, kvkLookupUrl } from "@/lib/utils";

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

describe("getVideoEmbedUrl", () => {
  it("herkent verschillende YouTube-linkvormen", () => {
    expect(getVideoEmbedUrl("https://www.youtube.com/watch?v=abc123XYZ_")).toBe("https://www.youtube.com/embed/abc123XYZ_");
    expect(getVideoEmbedUrl("https://youtu.be/abc123XYZ_")).toBe("https://www.youtube.com/embed/abc123XYZ_");
    expect(getVideoEmbedUrl("https://www.youtube.com/shorts/abc123XYZ_")).toBe("https://www.youtube.com/embed/abc123XYZ_");
  });

  it("herkent een Vimeo-link", () => {
    expect(getVideoEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
  });

  it("wijst onherkende links en ongeldige URL's af", () => {
    expect(getVideoEmbedUrl("https://example.com/video")).toBeNull();
    expect(getVideoEmbedUrl("niet-een-url")).toBeNull();
    expect(getVideoEmbedUrl("https://youtube.com/watch")).toBeNull(); // geen v=
  });
});

describe("isReviewRevealed", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("blijft verborgen als geen van beiden heeft ingevuld", () => {
    expect(isReviewRevealed(false, false, "2026-06-05", 14, now)).toBe(false); // venster (19 juni) nog niet verstreken
  });

  it("blijft verborgen als er nog maar één kant heeft ingevuld, binnen het venster", () => {
    expect(isReviewRevealed(true, false, "2026-06-05", 14, now)).toBe(false);
    expect(isReviewRevealed(false, true, "2026-06-05", 14, now)).toBe(false);
  });

  it("wordt meteen onthuld zodra allebei hebben ingevuld", () => {
    expect(isReviewRevealed(true, true, "2026-06-14", 14, now)).toBe(true);
  });

  it("wordt onthuld zodra het venster na de evenementdatum is verstreken, ook als er nog maar één kant is", () => {
    expect(isReviewRevealed(true, false, "2026-06-10", 14, now)).toBe(false); // venster (24 juni) nog niet verstreken
    expect(isReviewRevealed(true, false, "2026-05-01", 14, now)).toBe(true); // venster (15 mei) ruim verstreken
  });

  it("blijft verborgen zonder evenementdatum, zelfs als één kant al heeft ingevuld", () => {
    expect(isReviewRevealed(true, false, null, 14, now)).toBe(false);
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
