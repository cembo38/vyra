import "server-only";
import { callStructuredAI } from "@/lib/ai/client";
import { formatCurrency } from "@/lib/config";

/**
 * "AI-team"-dagrapport voor de platformeigenaar (spec-item #52 vervolg).
 *
 * Belangrijk architectuurbesluit: deze module bepaalt NOOIT zelf wélke
 * items er in het rapport staan — dat gebeurt volledig deterministisch in
 * generateAndStoreDailyBriefing() (lib/data/store.ts), rechtstreeks uit de
 * database. Deze module schrijft alleen de NARRATIEVE laag erbovenop: een
 * korte samenvatting + één kopzin per "teamlid", op basis van de kale
 * cijfers hieronder. Zo kan een AI-hallucinatie in het ergste geval een
 * ongelukkig geformuleerde zin opleveren, maar nooit een goedkeuren-knop
 * voor iets dat niet echt bestaat, of een verzonnen aantal.
 *
 * Gebruikt dezelfde beveiligde omgeving (injection guard, mock-fallback
 * zonder ANTHROPIC_API_KEY, logging) als de rest van de AI-laag — zie
 * lib/ai/client.ts.
 */

export const BRIEFING_TEAM_MEMBERS = {
  verificatie: "Leveranciers & Verificatie",
  vertrouwen: "Geschillen & Vertrouwen",
  groei: "Groei & Nieuwe Aanmeldingen",
  financien: "Financieel",
  veiligheid: "Platform & AI-veiligheid",
} as const;

export type BriefingTeamKey = keyof typeof BRIEFING_TEAM_MEMBERS;

export interface BriefingSignalBundle {
  pendingVerifications: number;
  openDisputes: number;
  newSuppliers: number;
  newUsers: number;
  flaggedAiCount: number;
  paymentsCount: number;
  revenueCents: number;
  /** Leveranciers die de reactietermijn op minstens één aanvraag hebben laten verlopen sinds het vorige rapport — puur informatief. */
  unresponsiveSupplierCount: number;
  /** Evenementen die net de inactiviteitsdrempel zijn gepasseerd sinds het vorige rapport — puur informatief. */
  stalledEventCount: number;
}

export interface BriefingNarrative {
  coordinatorSummary: string;
  teamHeadlines: Record<BriefingTeamKey, string>;
}

const TEAM_NAMES = Object.values(BRIEFING_TEAM_MEMBERS);

const SCHEMA = {
  type: "object",
  required: ["coordinatorSummary", "teamHeadlines"],
  properties: {
    coordinatorSummary: {
      type: "string",
      description:
        "2-4 zinnen, in de rol van een operationeel coördinator die 's ochtends kort aan de drukke CEO (Cem) rapporteert. Warm maar zakelijk, Nederlands, geen overdreven enthousiasme. Als er niets te melden is, zeg dat gewoon expliciet en gerust.",
    },
    teamHeadlines: {
      type: "object",
      description: "Eén korte kopzin per teamlid, gebaseerd uitsluitend op de meegegeven cijfers.",
      required: Object.keys(BRIEFING_TEAM_MEMBERS),
      properties: Object.fromEntries(
        Object.keys(BRIEFING_TEAM_MEMBERS).map((key) => [key, { type: "string", description: `Kopzin voor "${BRIEFING_TEAM_MEMBERS[key as BriefingTeamKey]}".` }])
      ),
    },
  },
} as const;

export async function generateBriefingNarrative(bundle: BriefingSignalBundle): Promise<{ narrative: BriefingNarrative; usedAI: boolean }> {
  const { data, usedAI } = await callStructuredAI<BriefingNarrative>({
    role: "admin_daily_briefing",
    system:
      `Je bent de coördinator van het interne "AI-team" van Vyra, een Nederlands AI-eventplanningsplatform. ` +
      `Elke dag geef je de platformeigenaar Cem een kort, prettig leesbaar overzicht van wat er speelt op het platform — ` +
      `zoals een operationeel manager dat aan een drukke CEO zou rapporteren, niet meer dan wat hij echt nodig heeft om zijn dag te plannen. ` +
      `De teamleden zijn: ${TEAM_NAMES.join(", ")}. Baseer je UITSLUITEND op de cijfers hieronder in GEBRUIKERSINVOER — verzin nooit extra feiten, namen of aantallen die daar niet in staan.`,
    user: JSON.stringify(bundle, null, 2),
    schema: SCHEMA,
    schemaName: "daily_briefing_narrative",
    mockFallback: () => buildMockNarrative(bundle),
  });
  return { narrative: data, usedAI };
}

function buildMockNarrative(b: BriefingSignalBundle): BriefingNarrative {
  const actionable = b.pendingVerifications + b.openDisputes;
  const nothingAtAll =
    actionable === 0 &&
    b.newSuppliers === 0 &&
    b.newUsers === 0 &&
    b.flaggedAiCount === 0 &&
    b.paymentsCount === 0 &&
    b.unresponsiveSupplierCount === 0 &&
    b.stalledEventCount === 0;

  const coordinatorSummary = nothingAtAll
    ? "Goedemorgen Cem. Niets te melden vandaag — geen nieuwe aanmeldingen, geschillen of verificatieverzoeken sinds het laatste rapport."
    : [
        "Goedemorgen Cem.",
        actionable > 0 ? `${actionable} punt${actionable === 1 ? "" : "en"} hieronder vraagt om jouw goedkeuring.` : null,
        b.newSuppliers > 0 || b.newUsers > 0 ? `Verder ${b.newSuppliers} nieuwe leverancier(s) en ${b.newUsers} nieuwe gebruiker(s) sinds gisteren.` : null,
        b.unresponsiveSupplierCount > 0 || b.stalledEventCount > 0
          ? `Ook ${b.unresponsiveSupplierCount} leverancier(s) met een verlopen reactietermijn en ${b.stalledEventCount} evenement(en) die stil lijken te liggen — puur ter info, geen actie vereist.`
          : null,
      ]
        .filter(Boolean)
        .join(" ");

  return {
    coordinatorSummary,
    teamHeadlines: {
      verificatie:
        b.pendingVerifications > 0
          ? `${b.pendingVerifications} leverancier${b.pendingVerifications === 1 ? "" : "s"} wacht${b.pendingVerifications === 1 ? "" : "en"} op verificatie.`
          : "Geen openstaande verificatieverzoeken.",
      vertrouwen:
        [
          b.openDisputes > 0 ? `${b.openDisputes} openstaand${b.openDisputes === 1 ? "" : "e"} geschil${b.openDisputes === 1 ? "" : "len"}.` : null,
          b.unresponsiveSupplierCount > 0
            ? `${b.unresponsiveSupplierCount} leverancier${b.unresponsiveSupplierCount === 1 ? "" : "s"} met een verlopen reactietermijn.`
            : null,
        ]
          .filter(Boolean)
          .join(" ") || "Geen openstaande geschillen of verlopen reactietermijnen.",
      groei:
        [
          b.newSuppliers + b.newUsers > 0 ? `${b.newSuppliers} nieuwe leverancier(s), ${b.newUsers} nieuwe gebruiker(s) sinds gisteren.` : null,
          b.stalledEventCount > 0 ? `${b.stalledEventCount} evenement(en) lijken stilgevallen.` : null,
        ]
          .filter(Boolean)
          .join(" ") || "Geen nieuwe aanmeldingen sinds gisteren.",
      financien: b.paymentsCount > 0 ? `${b.paymentsCount} nieuwe betaling(en), samen ${formatCurrency(b.revenueCents)}.` : "Geen nieuwe betalingen sinds gisteren.",
      veiligheid: b.flaggedAiCount > 0 ? `${b.flaggedAiCount} AI-interactie(s) gemarkeerd voor review.` : "Geen gemarkeerde AI-interacties.",
    },
  };
}
