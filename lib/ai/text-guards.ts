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

/**
 * BUG (gemeld aug. 2026): de budgetpagina (en andere vrije-tekst-adviezen,
 * gewoon via <p>{...}</p> getoond, zonder markdown-rendering) toonde
 * letterlijke `**vet**`-sterretjes en `# Kopjes` i.p.v. opgemaakte tekst.
 * Zelfde grondoorzoek als de rauwe-JSON-bug hierboven: FREE_TEXT_SAFETY_FOOTER
 * in lib/ai/prompts.ts verbood alleen JSON en ```-codeblokken, niet losse
 * markdown-opmaak binnen "gewone" tekst — dat is nu ook aangescherpt, maar
 * een taalmodel volgt instructies nooit met 100% garantie.
 *
 * Bewust ANDERS dan looksLikeRawJson hierboven: die verwerpt het hele
 * antwoord (valt terug op mock-tekst), omdat rauwe JSON een teken is dat het
 * model de instructie volledig negeerde. Hier is de inhoud zelf meestal wél
 * goed — alleen de opmaak niet — dus we ontsmetten in plaats van weg te
 * gooien: een goed budgetadvies verliezen om een paar sterretjes zou een
 * slechtere gebruikerservaring zijn dan het gewoon leesbaar maken.
 */
export function stripInlineMarkdown(text: string): string {
  return (
    text
      // **vet** en __vet__ → vet
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      // # Kop, ## Kop, ... aan het begin van een regel → gewoon de tekst
      .replace(/^#{1,6}\s+/gm, "")
      // *cursief* en _cursief_ (los, niet al door bovenstaande opgepakt)
      .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "$1")
      .replace(/(?<![\w_])_([^_\n]+?)_(?![\w_])/g, "$1")
      // opsommingstekens "- " of "* " aan het begin van een regel → weg (de
      // rest van de zin blijft gewoon staan, leesbaar als lopende tekst)
      .replace(/^[-*]\s+/gm, "")
  );
}
