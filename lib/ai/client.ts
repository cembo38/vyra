import "server-only";
import OpenAI from "openai";
import { AI_ENABLED } from "@/lib/config";

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!AI_ENABLED) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Generieke helper voor alle AI-rollen in het platform (zie §33/§56 van de
 * productspec: Event Understanding AI, Question Generator, Requirement
 * Generator, Budget Assistant, Timeline Generator, Event Assistant, ...).
 *
 * Elke rol krijgt een eigen system prompt + JSON-schema. Als er geen
 * OPENAI_API_KEY is geconfigureerd — of de aanroep faalt, bv. omdat de AI
 * API tijdelijk niet werkt — valt de functie terug op deterministische
 * mock-logica, zodat de gebruiker nooit vastloopt (zie §58 error handling).
 */
export async function callStructuredAI<T>(opts: {
  role: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  mockFallback: () => T;
}): Promise<{ data: T; usedAI: boolean }> {
  const client = getClient();
  if (!client) {
    return { data: opts.mockFallback(), usedAI: false };
  }
  try {
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, schema: opts.schema, strict: true },
      },
      temperature: 0.4,
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Leeg antwoord van AI-model");
    return { data: JSON.parse(content) as T, usedAI: true };
  } catch (err) {
    console.error(`[ai:${opts.role}] AI-aanroep mislukt, terugvallen op mock-logica.`, err);
    return { data: opts.mockFallback(), usedAI: false };
  }
}

/** Vrije-tekst chatcompletie (voor de Event Manager assistent). Valt terug op null bij fout. */
export async function callFreeTextAI(opts: { role: string; system: string; user: string }): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: 0.5,
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.error(`[ai:${opts.role}] AI-aanroep mislukt.`, err);
    return null;
  }
}
