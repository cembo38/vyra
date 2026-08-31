import "server-only";
import { callFreeTextAI } from "@/lib/ai/client";
import { FaqCategory, flattenFaq } from "@/lib/faq-content";

/**
 * "Vraag het VyrAI" bovenaan de Help & FAQ-pagina's (spec-item aug. 2026,
 * verzoek Cem: "wellicht kan je bovenin zelf VyrAI toevoegen zodat de AI
 * antwoord kan geven"). Bewust een APARTE, simpele AI-rol i.p.v. hergebruik
 * van askEventManager/askSupplierAssistant: dit is precies afgebakend tot
 * "beantwoord vragen op basis van de FAQ-inhoud", zonder toegang tot
 * persoonlijke evenement-/leveranciersgegevens en zonder abonnements-
 * gate/daglimiet (iedereen mag hulp vragen, ook zonder betaald niveau).
 *
 * De volledige FAQ-inhoud gaat als context mee in de system prompt — bij de
 * huidige, bescheiden omvang (een paar dozijn vraag/antwoord-items) ruim
 * binnen het budget van een enkele aanroep, en dit garandeert dat de AI
 * nooit iets anders verzint dan wat er daadwerkelijk op het platform klopt.
 */
function buildFaqSystemPrompt(audience: "organizer" | "supplier", categories: FaqCategory[]): string {
  const kennisbank = categories
    .map((c) => `## ${c.label}\n${c.entries.map((e) => `Vraag: ${e.question}\nAntwoord: ${e.answer}`).join("\n\n")}`)
    .join("\n\n");

  const doelgroep = audience === "organizer" ? "organisatoren (mensen die een evenement plannen)" : "leveranciers (bedrijven die diensten aanbieden op Vyra)";

  return `Je bent de VyrAI-hulpassistent op de Help & FAQ-pagina van Vyra, een Nederlands AI-ondersteund platform voor het plannen van evenementen. Deze pagina is specifiek voor ${doelgroep}.

Beantwoord de vraag van de gebruiker UITSLUITEND op basis van de kennisbank hieronder. Vat samen of combineer gerust meerdere items als dat relevant is, maar verzin nooit functionaliteit, prijzen of beleid die niet in deze kennisbank staan.

Weet je het antwoord niet zeker op basis van deze kennisbank, zeg dat dan eerlijk en verwijs de gebruiker naar de zoekfunctie op deze pagina of naar contact met Vyra — verzin nooit een antwoord.

Antwoord kort en concreet (meestal 2-4 zinnen), in het Nederlands, in een vriendelijke maar zakelijke toon. Gebruik geen opsommingstekens of markdown-opmaak, gewoon lopende tekst.

KENNISBANK:
${kennisbank}`;
}

/**
 * Simpele, deterministische fallback zonder AI: score elk item op het aantal
 * woorden dat overlapt met de vraag (zowel in de vraag als het antwoord van
 * dat item), en geef het antwoord van de best scorende match terug — zelfde
 * "nooit een dode knop"-principe als overal elders in dit project
 * (mockFallback-patroon in lib/ai/client.ts), hier met de hand uitgeschreven
 * omdat dit geen gestructureerde AI-rol is (geen callStructuredAI, dus geen
 * ingebouwde mockFallback-parameter).
 */
function mockFaqAnswer(question: string, entries: ReturnType<typeof flattenFaq>): string {
  const words = question
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) {
    return "Stel gerust een concrete vraag, of gebruik het zoekveld hieronder om zelf door alle onderwerpen te bladeren.";
  }

  let best: { entry: (typeof entries)[number]; score: number } | null = null;
  for (const entry of entries) {
    const haystack = `${entry.question} ${entry.answer}`.toLowerCase();
    const score = words.reduce((sum, w) => sum + (haystack.includes(w) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }

  if (!best) {
    return "Ik kon hier geen passend antwoord op vinden in de kennisbank. Probeer het zoekveld hieronder met andere woorden, of neem contact op met Vyra als je er niet uitkomt.";
  }
  return best.entry.answer;
}

export async function askFaqAssistant(question: string, audience: "organizer" | "supplier", categories: FaqCategory[]): Promise<{ answer: string; usedAI: boolean }> {
  const entries = flattenFaq(categories);
  const aiAnswer = await callFreeTextAI({
    role: audience === "organizer" ? "faq_organizer" : "faq_supplier",
    system: buildFaqSystemPrompt(audience, categories),
    user: question,
  });
  if (aiAnswer) return { answer: aiAnswer, usedAI: true };
  return { answer: mockFaqAnswer(question, entries), usedAI: false };
}
