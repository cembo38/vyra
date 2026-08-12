"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  addEventNote,
  addInterviewMessage,
  createEvent,
  getEvent,
  getInterviewMessages,
  getRequirements,
  pushNotification,
  setRequirements,
  setRisks,
  setTasks,
  setTimeline,
  toggleRequirementSelection,
  updateEvent,
} from "@/lib/data/store";
import { extractEventFields, generateNextQuestion } from "@/lib/ai/interview";
import { generateRequirementPlan, generateTimeline, detectRisks } from "@/lib/ai/planning";
import { detectChangeImpact } from "@/lib/ai/assistant";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { uid } from "@/lib/utils";

async function applyExtractedFields(eventId: string, extracted: Awaited<ReturnType<typeof extractEventFields>>["data"]) {
  const event = await getEvent(eventId);
  if (!event) return;
  const patch: Parameters<typeof updateEvent>[1] = {};

  if (extracted.eventType && event.type === "other") patch.type = extracted.eventType;
  if (extracted.guestCountAdults != null && event.guestCountAdults == null) patch.guestCountAdults = extracted.guestCountAdults;
  if (extracted.guestCountChildren != null && event.guestCountChildren == null) patch.guestCountChildren = extracted.guestCountChildren;
  if (extracted.locationLabel && !event.locationLabel) patch.locationLabel = extracted.locationLabel;
  if (extracted.locationType && !event.locationType) patch.locationType = extracted.locationType;
  if (extracted.indoorOutdoor && !event.indoorOutdoor) patch.indoorOutdoor = extracted.indoorOutdoor;
  if (extracted.budgetCents != null && !event.budget) patch.budget = { totalCents: extracted.budgetCents, source: "user" };
  if (extracted.formality && !event.formality) patch.formality = extracted.formality;
  if (extracted.style && !event.style) patch.style = extracted.style;
  if (extracted.isProfessional != null) patch.isProfessional = extracted.isProfessional;
  if (extracted.eventName) patch.name = extracted.eventName;
  else if (event.name === "Nieuw evenement" && extracted.eventType) patch.name = `${EVENT_TYPE_LABELS[extracted.eventType]}${extracted.locationLabel ? " in " + extracted.locationLabel : ""}`;

  if (Object.keys(patch).length > 0) await updateEvent(eventId, patch);
}

export async function startInterviewAction(description: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await createEvent(user.id, description);
  await addInterviewMessage({ eventId: event.id, role: "user", text: description });

  const { data: extracted } = await extractEventFields(description);
  await applyExtractedFields(event.id, extracted);

  const updatedEvent = (await getEvent(event.id))!;
  const { data: nextQ } = await generateNextQuestion(updatedEvent, await getInterviewMessages(event.id));

  const assistantMessage = nextQ.done
    ? "Dank je, ik heb genoeg om een eerste plan voor je te maken. Klik hieronder om je AI-eventplan te bekijken."
    : nextQ.question ?? "Vertel me gerust meer over je evenement.";

  await addInterviewMessage({ eventId: event.id, role: "assistant", text: assistantMessage });

  revalidatePath("/events");
  return { eventId: event.id, assistantMessage, done: nextQ.done };
}

export async function continueInterviewAction(eventId: string, userMessage: string) {
  await addInterviewMessage({ eventId, role: "user", text: userMessage });

  const { data: extracted } = await extractEventFields(userMessage);
  await applyExtractedFields(eventId, extracted);

  const updatedEvent = (await getEvent(eventId))!;
  const { data: nextQ } = await generateNextQuestion(updatedEvent, await getInterviewMessages(eventId));

  const assistantMessage = nextQ.done
    ? "Helder — ik denk dat ik nu voldoende weet om een sterk eerste plan te maken. Klik hieronder om je AI-eventplan te bekijken."
    : nextQ.question ?? "Vertel me gerust meer.";

  await addInterviewMessage({ eventId, role: "assistant", text: assistantMessage });
  revalidatePath(`/events/${eventId}`, "layout");
  return { assistantMessage, done: nextQ.done };
}

export async function generatePlanAction(eventId: string) {
  const event = await getEvent(eventId);
  if (!event) return;

  const { categories } = await generateRequirementPlan(event);
  await setRequirements(eventId, categories);

  const { timeline } = await generateTimeline(event, categories);
  await setTimeline(eventId, timeline);

  const { risks } = await detectRisks(event, categories);
  await setRisks(eventId, risks);

  const urgentEssentials = categories.filter((c) => c.selected && c.priority === "essential");
  await setTasks(
    eventId,
    urgentEssentials.slice(0, 2).map((c) => ({
      id: uid("task"),
      eventId,
      title: `Verstuur een aanvraag voor ${c.label}`,
      urgency: "soon" as const,
      done: false,
      source: "ai_recommendation" as const,
      relatedCategory: c.categoryKey,
    }))
  );

  await updateEvent(eventId, { stage: "planning" });
  revalidatePath(`/events/${eventId}`, "layout");
  redirect(`/events/${eventId}/plan`);
}

export async function toggleRequirementAction(eventId: string, categoryId: string, selected: boolean) {
  await toggleRequirementSelection(eventId, categoryId, selected);
  revalidatePath(`/events/${eventId}`, "layout");
}

export async function confirmRequirementsAction(eventId: string) {
  const requirements = await getRequirements(eventId);
  const selected = requirements.filter((c) => c.selected);
  if (selected.length > 0) {
    await updateEvent(eventId, { stage: "sourcing" });
  }
  revalidatePath(`/events/${eventId}`, "layout");
  redirect(`/events/${eventId}/requests`);
}

function mockChangeImpact(text: string): string {
  const lower = text.toLowerCase();
  if (/gast|gasten|mensen|personen/.test(lower) && /\d/.test(lower)) {
    return "AI-aanbeveling: bij een gewijzigd aantal gasten is het slim om je cateringaanvraag en het aantal stoelen/tafels opnieuw te laten doorrekenen.";
  }
  if (/budget|euro|€/.test(lower)) {
    return "AI-aanbeveling: controleer de budgetpagina — met dit gewijzigde budget kan de verdeling over categorieën aangepast worden.";
  }
  if (/locatie|plek|adres/.test(lower)) {
    return "AI-aanbeveling: een gewijzigde locatie kan gevolgen hebben voor leveranciers die al een aanvraag hebben ontvangen (reisafstand, beschikbaarheid).";
  }
  return "AI-aanbeveling: deze informatie is toegevoegd aan je evenement en zichtbaar voor jezelf; controleer of dit gevolgen heeft voor eerder gemaakte keuzes.";
}

export async function addNoteAction(eventId: string, text: string) {
  const event = await getEvent(eventId);
  if (!event || !text.trim()) return;

  const aiImpact = await detectChangeImpact(text, event);
  const impact = aiImpact ?? mockChangeImpact(text);

  await addEventNote(eventId, text, "user", impact);
  await pushNotification({
    userId: event.ownerId,
    eventId,
    type: "event_info_changed",
    title: "Eventinformatie bijgewerkt",
    body: text,
    href: `/events/${eventId}`,
  });
  revalidatePath(`/events/${eventId}`, "layout");
  return { impact };
}
