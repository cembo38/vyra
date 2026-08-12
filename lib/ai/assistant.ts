import "server-only";
import { callFreeTextAI } from "@/lib/ai/client";
import { EVENT_MANAGER_PROMPT, BUDGET_ASSISTANT_PROMPT, CHANGE_DETECTION_PROMPT } from "@/lib/ai/prompts";
import { formatCurrency } from "@/lib/config";
import {
  EventBudgetSummary,
  EventCore,
  EventTask,
  EventTimelineItem,
  OfferOption,
  RequirementCategory,
  ServiceRequest,
  EVENT_TYPE_LABELS,
} from "@/lib/types";

interface EventManagerContext {
  event: EventCore;
  requirements: RequirementCategory[];
  requests: ServiceRequest[];
  offers: OfferOption[];
  budget: EventBudgetSummary;
  tasks: EventTask[];
  timeline: EventTimelineItem[];
}

function serializeContext(ctx: EventManagerContext) {
  return JSON.stringify({
    event: {
      naam: ctx.event.name,
      type: EVENT_TYPE_LABELS[ctx.event.type],
      datum: ctx.event.date,
      gasten: (ctx.event.guestCountAdults ?? 0) + (ctx.event.guestCountChildren ?? 0),
      locatie: ctx.event.locationLabel,
    },
    budget: {
      totaal: formatCurrency(ctx.budget.totalCents),
      gecommitteerd: formatCurrency(ctx.budget.committedCents),
      verwacht: formatCurrency(ctx.budget.pendingCents),
      resterend: formatCurrency(ctx.budget.remainingCents),
      percentBovenBudget: ctx.budget.percentOverBudget,
    },
    categorieen: ctx.requirements.filter((r) => r.selected).map((r) => ({ label: r.label, status: r.status, prioriteit: r.priority })),
    aanvragen: ctx.requests.map((r) => ({ categorie: r.categoryKey, status: r.status, deadline: r.deadlineAt })),
    offertes: ctx.offers.map((o) => ({ categorie: o.categoryKey, status: o.status, prijs: formatCurrency(o.totalPriceCents), swipe: o.swipeDecision })),
    taken: ctx.tasks.map((t) => ({ titel: t.title, urgentie: t.urgency, klaar: t.done })),
    planning: ctx.timeline.map((t) => ({ titel: t.title, deadline: t.dueDate, klaar: t.done })),
  });
}

function mockEventManagerAnswer(question: string, ctx: EventManagerContext): string {
  const q = question.toLowerCase();
  const missingEssentials = ctx.requirements.filter((r) => r.selected && r.priority === "essential" && r.status !== "confirmed" && r.status !== "paid" && r.status !== "completed");
  const notResponded = ctx.requests.filter((r) => r.status === "awaiting_response" || r.status === "sent");
  const urgentTasks = ctx.tasks.filter((t) => !t.done && t.urgency === "urgent");

  if (/nog.*regelen|wat moet ik|vergeten/.test(q)) {
    if (missingEssentials.length === 0 && urgentTasks.length === 0) {
      return "Je essentiële categorieën staan er goed voor. Ik zie geen urgente losse eindjes op dit moment — check gerust de shortlist voor de categorieën die nog een keuze wachten.";
    }
    const bits: string[] = [];
    if (missingEssentials.length) bits.push(`de essentiële categorie${missingEssentials.length > 1 ? "ën" : ""} ${missingEssentials.map((r) => r.label).join(", ")}`);
    if (urgentTasks.length) bits.push(`${urgentTasks.length} urgente taak/taken: ${urgentTasks.map((t) => t.title).join("; ")}`);
    return `Op basis van je huidige status zou ik eerst kijken naar ${bits.join(" en ")}.`;
  }

  if (/nog niet.*(reageer|gereageerd)|welke leveranciers/.test(q)) {
    if (notResponded.length === 0) return "Alle leveranciers waar je een aanvraag naartoe hebt gestuurd, hebben inmiddels gereageerd.";
    return `Deze categorieën wachten nog op een reactie: ${notResponded.map((r) => r.categoryKey).join(", ")}. Je kunt de deadline per aanvraag terugvinden op de aanvragenpagina.`;
  }

  if (/budget/.test(q)) {
    const over = ctx.budget.percentOverBudget;
    if (over > 0) {
      return `Je verwachte totaal ligt momenteel ${over}% boven je oorspronkelijke budget van ${formatCurrency(ctx.budget.totalCents)}. Overweeg een categorie met een lagere prioriteit te verlagen of te schrappen — bijvoorbeeld een optionele categorie.`;
    }
    return `Je zit binnen budget: ${formatCurrency(ctx.budget.committedCents)} vastgelegd en ${formatCurrency(ctx.budget.pendingCents)} nog verwacht, van in totaal ${formatCurrency(ctx.budget.totalCents)}.`;
  }

  if (/urgent/.test(q)) {
    if (urgentTasks.length === 0) return "Er staan op dit moment geen urgente taken open.";
    return `Urgent: ${urgentTasks.map((t) => t.title).join("; ")}.`;
  }

  if (/deze week/.test(q)) {
    const upcoming = ctx.timeline.filter((t) => !t.done).slice(0, 2);
    if (upcoming.length === 0) return "Er staan geen openstaande planningsitems meer voor de komende tijd.";
    return `Kijk deze week vooral naar: ${upcoming.map((t) => t.title).join(", ")}.`;
  }

  return "Ik heb je vraag genoteerd. Op basis van de huidige gegevens van dit evenement zie ik geen directe knelpunten — bekijk het dashboard voor het volledige overzicht van budget, planning en openstaande aanvragen.";
}

export async function askEventManager(question: string, ctx: EventManagerContext): Promise<{ answer: string; usedAI: boolean }> {
  const aiAnswer = await callFreeTextAI({
    role: "event_manager",
    system: EVENT_MANAGER_PROMPT,
    user: `Contextdata van het evenement (JSON): ${serializeContext(ctx)}\n\nVraag van de organisator: "${question}"`,
  });
  if (aiAnswer) return { answer: aiAnswer, usedAI: true };
  return { answer: mockEventManagerAnswer(question, ctx), usedAI: false };
}

export async function getBudgetAdvice(ctx: EventManagerContext): Promise<{ answer: string; usedAI: boolean }> {
  if (ctx.budget.percentOverBudget <= 0) {
    return { answer: `Je zit binnen budget. Van je totaal van ${formatCurrency(ctx.budget.totalCents)} is ${formatCurrency(ctx.budget.committedCents)} al vastgelegd en ${formatCurrency(ctx.budget.pendingCents)} nog verwacht voor openstaande categorieën.`, usedAI: false };
  }
  const aiAnswer = await callFreeTextAI({
    role: "budget_assistant",
    system: BUDGET_ASSISTANT_PROMPT,
    user: `Budget: ${serializeContext(ctx)}`,
  });
  if (aiAnswer) return { answer: aiAnswer, usedAI: true };
  return {
    answer: `Je zit momenteel ${ctx.budget.percentOverBudget}% boven je oorspronkelijke budget van ${formatCurrency(ctx.budget.totalCents)}. Overweeg een optionele of aanbevolen categorie te verlagen, of vraag een goedkoper alternatief aan bij een andere leverancier.`,
    usedAI: false,
  };
}

export async function detectChangeImpact(changeText: string, event: EventCore): Promise<string | null> {
  const aiAnswer = await callFreeTextAI({
    role: "change_detection",
    system: CHANGE_DETECTION_PROMPT,
    user: `Evenement: ${EVENT_TYPE_LABELS[event.type]}, ${event.guestCountAdults ?? "?"} gasten, budget ${event.budget?.totalCents ? formatCurrency(event.budget.totalCents) : "onbekend"}.\nNieuwe informatie van de gebruiker: "${changeText}"`,
  });
  return aiAnswer;
}
