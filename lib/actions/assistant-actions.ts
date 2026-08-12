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
  const event = await getEvent(eventId);
  if (!event) return { answer: "Ik kan dit evenement niet vinden.", usedAI: false };

  const [requirements, requests, offers, budget, tasks, timeline] = await Promise.all([
    getRequirements(eventId),
    getRequestsForEvent(eventId),
    getOffersForEvent(eventId),
    getBudgetSummary(eventId),
    getTasks(eventId),
    getTimeline(eventId),
  ]);

  return askEventManager(question, { event, requirements, requests, offers, budget, tasks, timeline });
}
