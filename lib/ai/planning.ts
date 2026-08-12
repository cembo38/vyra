import "server-only";
import { callStructuredAI } from "@/lib/ai/client";
import { REQUIREMENT_GENERATOR_PROMPT, TIMELINE_ASSISTANT_PROMPT, RISK_DETECTION_PROMPT } from "@/lib/ai/prompts";
import { ALL_SUPPLIER_CATEGORIES, buildDefaultRequirements } from "@/lib/ai/catalog";
import { EventCore, EventTimelineItem, RequirementCategory, RequirementPriority, RiskFlag, SupplierCategory, EVENT_TYPE_LABELS, SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { uid } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Requirement Generator AI                                            */
/* ------------------------------------------------------------------ */

interface AiCategorySuggestion {
  categoryKey: SupplierCategory;
  priority: RequirementPriority;
  rationale: string;
  estimatedBudgetCents: number | null;
}

const REQUIREMENTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    categories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          categoryKey: { type: "string", enum: ALL_SUPPLIER_CATEGORIES },
          priority: { type: "string", enum: ["essential", "recommended", "optional"] },
          rationale: { type: "string" },
          estimatedBudgetCents: { type: ["number", "null"] },
        },
        required: ["categoryKey", "priority", "rationale", "estimatedBudgetCents"],
      },
    },
  },
  required: ["categories"],
};

export async function generateRequirementPlan(event: EventCore) {
  const { data, usedAI } = await callStructuredAI<{ categories: AiCategorySuggestion[] }>({
    role: "requirement_generator",
    system: REQUIREMENT_GENERATOR_PROMPT,
    user: `Evenement: ${JSON.stringify({
      type: EVENT_TYPE_LABELS[event.type],
      naam: event.name,
      gasten: (event.guestCountAdults ?? 0) + (event.guestCountChildren ?? 0),
      locatie: event.locationLabel,
      budget: event.budget?.totalCents,
      stijl: event.style,
      formaliteit: event.formality,
      zakelijk: event.isProfessional,
      beschrijving: event.description,
    })}\nToegestane categorie-sleutels: ${ALL_SUPPLIER_CATEGORIES.join(", ")}`,
    schema: REQUIREMENTS_SCHEMA,
    schemaName: "requirement_plan",
    mockFallback: () => ({
      categories: buildDefaultRequirements(event).map((r) => ({
        categoryKey: r.categoryKey,
        priority: r.priority,
        rationale: r.aiRationale,
        estimatedBudgetCents: r.estimatedBudgetCents,
      })),
    }),
  });

  const categories: RequirementCategory[] = data.categories.map((c) => ({
    id: uid("reqc"),
    eventId: event.id,
    categoryKey: c.categoryKey,
    label: SUPPLIER_CATEGORY_LABELS[c.categoryKey] ?? c.categoryKey,
    priority: c.priority,
    aiRationale: c.rationale,
    selected: c.priority !== "optional",
    estimatedBudgetCents: c.estimatedBudgetCents,
    status: "suggested",
  }));

  return { categories, usedAI };
}

/* ------------------------------------------------------------------ */
/* Timeline Generator AI                                               */
/* ------------------------------------------------------------------ */

interface AiTimelineItem {
  title: string;
  leadTimeLabel: string;
  daysBeforeEvent: number;
  categoryKey: SupplierCategory | null;
}

const TIMELINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          leadTimeLabel: { type: "string" },
          daysBeforeEvent: { type: "number" },
          categoryKey: { type: ["string", "null"], enum: [...ALL_SUPPLIER_CATEGORIES, null] },
        },
        required: ["title", "leadTimeLabel", "daysBeforeEvent", "categoryKey"],
      },
    },
  },
  required: ["items"],
};

function mockTimeline(event: EventCore, categories: RequirementCategory[]): AiTimelineItem[] {
  const selected = categories.filter((c) => c.selected).sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority));
  const essentials = selected.filter((c) => c.priority === "essential");
  const recommended = selected.filter((c) => c.priority === "recommended");

  const items: AiTimelineItem[] = [];
  if (essentials[0]) items.push({ title: `${essentials[0].label} regelen`, leadTimeLabel: "6 maanden vooraf", daysBeforeEvent: 180, categoryKey: essentials[0].categoryKey });
  if (essentials[1]) items.push({ title: `${essentials[1].label} boeken`, leadTimeLabel: "4 maanden vooraf", daysBeforeEvent: 120, categoryKey: essentials[1].categoryKey });
  if (essentials[2]) items.push({ title: `${essentials[2].label} vastleggen`, leadTimeLabel: "3 maanden vooraf", daysBeforeEvent: 90, categoryKey: essentials[2].categoryKey });
  if (recommended[0]) items.push({ title: `${recommended[0].label} afronden`, leadTimeLabel: "2 maanden vooraf", daysBeforeEvent: 60, categoryKey: recommended[0].categoryKey });
  items.push({ title: "Definitief aantal gasten doorgeven aan alle leveranciers", leadTimeLabel: "1 maand vooraf", daysBeforeEvent: 30, categoryKey: null });
  items.push({ title: "Laatste bevestigingen met alle leveranciers", leadTimeLabel: "1 week vooraf", daysBeforeEvent: 7, categoryKey: null });
  items.push({ title: "Opbouw en laatste voorbereidingen", leadTimeLabel: "1 dag vooraf", daysBeforeEvent: 1, categoryKey: null });
  return items;
}

function priorityScore(p: RequirementPriority) {
  return p === "essential" ? 3 : p === "recommended" ? 2 : 1;
}

export async function generateTimeline(event: EventCore, categories: RequirementCategory[]) {
  const { data, usedAI } = await callStructuredAI<{ items: AiTimelineItem[] }>({
    role: "timeline_generator",
    system: TIMELINE_ASSISTANT_PROMPT,
    user: `Evenement op ${event.date ?? "een nog onbekende datum"}. Geselecteerde categorieën: ${JSON.stringify(
      categories.filter((c) => c.selected).map((c) => ({ label: c.label, priority: c.priority, categoryKey: c.categoryKey }))
    )}`,
    schema: TIMELINE_SCHEMA,
    schemaName: "timeline_plan",
    mockFallback: () => ({ items: mockTimeline(event, categories) }),
  });

  const referenceDate = event.date ? new Date(event.date) : null;
  const timeline: EventTimelineItem[] = data.items.map((item) => ({
    id: uid("tl"),
    eventId: event.id,
    title: item.title,
    dueDate: referenceDate ? new Date(referenceDate.getTime() - item.daysBeforeEvent * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : null,
    leadTimeLabel: item.leadTimeLabel,
    categoryKey: item.categoryKey,
    done: false,
    source: "ai_recommendation",
  }));

  return { timeline, usedAI };
}

/* ------------------------------------------------------------------ */
/* Risk Detection AI                                                   */
/* ------------------------------------------------------------------ */

export function detectRisksMock(event: EventCore, categories: RequirementCategory[]): RiskFlag[] {
  const risks: RiskFlag[] = [];
  const has = (key: SupplierCategory) => categories.some((c) => c.categoryKey === key && c.selected);

  if ((event.indoorOutdoor === "outdoor" || event.indoorOutdoor === "both") && !has("tent_rental")) {
    risks.push({
      id: uid("risk"),
      eventId: event.id,
      severity: "warning",
      message: "Dit is een AI-signalering: je evenement is (deels) buiten, maar er is nog geen tent of overkapping geregeld als back-up bij regen.",
      createdAt: new Date().toISOString(),
    });
  }

  const totalGuests = (event.guestCountAdults ?? 0) + (event.guestCountChildren ?? 0);
  if (totalGuests > 0 && event.locationType === "home" && !has("furniture_rental")) {
    risks.push({
      id: uid("risk"),
      eventId: event.id,
      severity: "warning",
      message: `Dit is een AI-signalering: bij ${totalGuests} gasten thuis is extra zitgelegenheid vaak nodig, maar meubelverhuur staat nog niet in je plan.`,
      createdAt: new Date().toISOString(),
    });
  }

  const missingEssentials = categories.filter((c) => c.selected && c.priority === "essential" && c.status === "suggested");
  if (missingEssentials.length > 0) {
    risks.push({
      id: uid("risk"),
      eventId: event.id,
      severity: "info",
      message: `Dit is een AI-signalering: ${missingEssentials.length} essentiële categorie(ën) zijn nog niet aangevraagd bij leveranciers: ${missingEssentials.map((c) => c.label).join(", ")}.`,
      createdAt: new Date().toISOString(),
    });
  }

  return risks;
}

export async function detectRisks(event: EventCore, categories: RequirementCategory[]) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      risks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { severity: { type: "string", enum: ["warning", "info"] }, message: { type: "string" } },
          required: ["severity", "message"],
        },
      },
    },
    required: ["risks"],
  };
  const { data, usedAI } = await callStructuredAI<{ risks: { severity: "warning" | "info"; message: string }[] }>({
    role: "risk_detection",
    system: RISK_DETECTION_PROMPT,
    user: `Evenement: ${JSON.stringify({
      type: EVENT_TYPE_LABELS[event.type],
      gasten: (event.guestCountAdults ?? 0) + (event.guestCountChildren ?? 0),
      indoorOutdoor: event.indoorOutdoor,
      locationType: event.locationType,
    })}\nGeselecteerde categorieën: ${JSON.stringify(categories.filter((c) => c.selected).map((c) => ({ label: c.label, status: c.status, priority: c.priority })))}`,
    schema,
    schemaName: "risk_flags",
    mockFallback: () => ({ risks: detectRisksMock(event, categories).map((r) => ({ severity: r.severity, message: r.message })) }),
  });

  const risks: RiskFlag[] = data.risks.map((r) => ({ id: uid("risk"), eventId: event.id, severity: r.severity, message: r.message, createdAt: new Date().toISOString() }));
  return { risks, usedAI };
}
