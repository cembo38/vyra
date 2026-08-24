import { describe, expect, it } from "vitest";
import { looksLikeRawJson, stripMarkdownCodeFence } from "@/lib/ai/text-guards";

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
