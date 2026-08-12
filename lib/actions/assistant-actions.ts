"use server";

import { askEventManager } from "@/lib/ai/assistant";
import {
  getBudgetSummary,
  getEvent,
  getOffersForEvent,
  getRequestsForEvent,
  getRequirements,
  getTasks,
  getTimeline,
} from "@/lib/data/store";

export async function askAssistantAction(eventId: string, question: string) {
  const event = getEvent(eventId);
  if (!event) return { answer: "Ik kan dit evenement niet vinden.", usedAI: false };

  const ctx = {
    event,
    requirements: getRequirements(eventId),
    requests: getRequestsForEvent(eventId),
    offers: getOffersForEvent(eventId),
    budget: getBudgetSummary(eventId),
    tasks: getTasks(eventId),
    timeline: getTimeline(eventId),
  };

  return askEventManager(question, ctx);
}
