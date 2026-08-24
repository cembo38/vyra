/**
 * Losstaande tekstcontroles voor AI-antwoorden die vrije tekst horen te zijn
 * (callFreeTextAI() in lib/ai/client.ts) — hier ondergebracht i.p.v. inline
 * in client.ts (dat "server-only" importeert) zodat vitest dit wél kan
 * testen, zie vitest.config.ts.
 *
 * BUG (gemeld aug. 2026): de budgetpagina toonde een keer een letterlijke,
 * rauwe JSON-brij als "AI-advies" i.p.v. leesbare tekst. Hoofdoorzaak was een
 * verkeerde gedeelde prompt-instructie (zie SAFETY_FOOTER-fix in
 * lib/ai/prompts.ts), maar een taalmodel volgt instructies nooit met 100%
 * garantie — dit is de laatste linie die dat soort antwoorden opvangt vóórdat
 * ze een gebruiker bereiken.
 */

export function stripMarkdownCodeFence(text: string): string {
  const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : text.trim();
}

export function looksLikeRawJson(text: string): boolean {
  const unwrapped = stripMarkdownCodeFence(text);
  if (!(unwrapped.startsWith("{") || unwrapped.startsWith("["))) return false;
  try {
    JSON.parse(unwrapped);
    return true;
  } catch {
    return false;
  }
}
