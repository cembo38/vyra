"use server";

import { askFaqAssistant } from "@/lib/ai/faq";
import { ORGANIZER_FAQ, SUPPLIER_FAQ } from "@/lib/faq-content";

/** Max. lengte van een FAQ-vraag — ruim genoeg voor een normale vraag, voorkomt onnodig grote AI-aanroepen bij plak-ongelukken. */
const MAX_QUESTION_LENGTH = 500;

/**
 * "Vraag het VyrAI" op de Help & FAQ-pagina's — bewust GEEN inlog- of
 * abonnements-check (in tegenstelling tot de andere VyrAI-assistenten in dit
 * project): hulp vinden op de FAQ-pagina moet voor iedereen die er komt
 * meteen werken, zonder drempel.
 */
export async function askFaqAction(question: string, audience: "organizer" | "supplier"): Promise<{ answer: string; usedAI: boolean }> {
  const trimmed = question.trim().slice(0, MAX_QUESTION_LENGTH);
  if (!trimmed) return { answer: "Stel gerust een vraag hierboven.", usedAI: false };

  const categories = audience === "supplier" ? SUPPLIER_FAQ : ORGANIZER_FAQ;
  return askFaqAssistant(trimmed, audience, categories);
}
