import { describe, expect, it } from "vitest";
import { looksLikeRawJson, stripInlineMarkdown, stripMarkdownCodeFence } from "@/lib/ai/text-guards";

/**
 * Dekt de "budgetpagina toonde rauwe JSON"-bug (aug. 2026, zie
 * lib/ai/client.ts en de SAFETY_FOOTER-fix in lib/ai/prompts.ts).
 */
describe("looksLikeRawJson", () => {
  it("herkent kale JSON als JSON", () => {
    expect(looksLikeRawJson('{"status": "success", "advies": "..."}')).toBe(true);
    expect(looksLikeRawJson("[1, 2, 3]")).toBe(true);
  });

  it("herkent JSON verpakt in een markdown-codeblok als JSON", () => {
    expect(looksLikeRawJson('```json\n{"status": "success"}\n```')).toBe(true);
    expect(looksLikeRawJson('```\n{"status": "success"}\n```')).toBe(true);
  });

  it("herkent gewone, natuurlijke tekst NIET als JSON", () => {
    expect(looksLikeRawJson("Je zit momenteel 20% boven je budget. Overweeg de decoratie te schrappen.")).toBe(false);
  });

  it("herkent tekst die toevallig met een accolade begint maar geen geldige JSON is niet als JSON", () => {
    expect(looksLikeRawJson("{dit is geen JSON, gewoon een zin met een accolade}")).toBe(false);
  });

  it("herkent lege tekst niet als JSON", () => {
    expect(looksLikeRawJson("")).toBe(false);
  });
});

describe("stripMarkdownCodeFence", () => {
  it("haalt ```json-hekjes weg", () => {
    expect(stripMarkdownCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("haalt kale ```-hekjes weg", () => {
    expect(stripMarkdownCodeFence('```\nhallo\n```')).toBe("hallo");
  });

  it("laat tekst zonder hekjes ongemoeid (op trimmen na)", () => {
    expect(stripMarkdownCodeFence("  gewone tekst  ")).toBe("gewone tekst");
  });
});

/**
 * Dekt de "budgetpagina toonde letterlijke **sterretjes**"-bug (aug. 2026,
 * zie lib/ai/client.ts en de FREE_TEXT_SAFETY_FOOTER-fix in
 * lib/ai/prompts.ts).
 */
describe("stripInlineMarkdown", () => {
  it("haalt **vet** en __vet__ weg", () => {
    expect(stripInlineMarkdown("**1. Budget aanpassen**")).toBe("1. Budget aanpassen");
    expect(stripInlineMarkdown("Dit is __belangrijk__ om te weten.")).toBe("Dit is belangrijk om te weten.");
  });

  it("haalt # kopjes aan het begin van een regel weg", () => {
    expect(stripInlineMarkdown("## Prioriteiten scherper stellen\nVervolgtekst.")).toBe("Prioriteiten scherper stellen\nVervolgtekst.");
  });

  it("haalt losse *cursief*/_cursief_ weg zonder gewone tekst te beschadigen", () => {
    expect(stripInlineMarkdown("Dit is *cursief* gedeelte.")).toBe("Dit is cursief gedeelte.");
    expect(stripInlineMarkdown("Dit is _cursief_ gedeelte.")).toBe("Dit is cursief gedeelte.");
  });

  it("haalt opsommingstekens (- of *) aan het begin van een regel weg", () => {
    expect(stripInlineMarkdown("- Verlaag de decoratie\n- Schrap de DJ")).toBe("Verlaag de decoratie\nSchrap de DJ");
  });

  it("verwerkt een realistisch AI-antwoord met gemengde opmaak volledig naar leesbare tekst", () => {
    const raw = "**1. Budget aanpassen**\nOverweeg het budget te verhogen.\n\n**2. Prioriteiten scherper stellen**\n- Verlaag de cateringkosten\n- Schrap de fotograaf";
    const cleaned = stripInlineMarkdown(raw);
    expect(cleaned).not.toContain("*");
    expect(cleaned).toContain("1. Budget aanpassen");
    expect(cleaned).toContain("Verlaag de cateringkosten");
  });

  it("laat gewone tekst zonder opmaak ongemoeid", () => {
    expect(stripInlineMarkdown("Je zit momenteel 20% boven je budget.")).toBe("Je zit momenteel 20% boven je budget.");
  });

  it("beschadigt normaal taalgebruik met een enkel sterretje of underscore niet", () => {
    expect(stripInlineMarkdown("De prijs is 50 euro* (excl. btw)")).toBe("De prijs is 50 euro* (excl. btw)");
    expect(stripInlineMarkdown("mijn_variabele_naam blijft intact")).toBe("mijn_variabele_naam blijft intact");
  });
});
