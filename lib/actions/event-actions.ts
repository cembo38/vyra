"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  addEventNote,
  addInterviewMessage,
  createEvent,
  deleteEvent,
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
  updateRequirementDraftMessage,
} from "@/lib/data/store";
import { extractEventFields, generateNextQuestion } from "@/lib/ai/interview";
import { generateRequirementPlan, generateTimeline, detectRisks, draftSupplierMessages } from "@/lib/ai/planning";
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
  // Alleen een maand genoemd ("ergens in juni"), geen exacte datum — bewaar
  // 'm apart zodat dit antwoord niet verloren gaat (zie migratie 0013).
  // Zodra een exacte datum bekend is (via de losse datumkiezer) is deze
  // hint niet meer relevant, dus dan niet meer overschrijven.
  if (extracted.monthHint && !event.date && !event.monthHint) patch.monthHint = extracted.monthHint;
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

  const { data: extracted } = await extractEventFields(description, { userId: user.id, eventId: event.id });
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
  // Deze actie had, anders dan bijna elke andere in dit bestand, geen
  // login-/eigenaarscheck — wie ook maar een geldige eventId kende kon
  // daarmee het interview van een ánder account laten doorlopen. Bracht ook
  // een crash-risico met zich mee: `(await getEvent(eventId))!` hieronder
  // ging er zonder check van uit dat het event nog bestond.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const currentEvent = await getEvent(eventId);
  if (!currentEvent || currentEvent.ownerId !== user.id) redirect("/events");

  await addInterviewMessage({ eventId, role: "user", text: userMessage });

  const { data: extracted } = await extractEventFields(userMessage, { userId: currentEvent.ownerId, eventId });
  await applyExtractedFields(eventId, extracted);

  const updatedEvent = await getEvent(eventId);
  if (!updatedEvent) return { assistantMessage: "Er ging iets mis — probeer het nog eens.", done: false };
  const { data: nextQ } = await generateNextQuestion(updatedEvent, await getInterviewMessages(eventId));

  const assistantMessage = nextQ.done
    ? "Helder — ik denk dat ik nu voldoende weet om een sterk eerste plan te maken. Klik hieronder om je AI-eventplan te bekijken."
    : nextQ.question ?? "Vertel me gerust meer.";

  await addInterviewMessage({ eventId, role: "assistant", text: assistantMessage });
  revalidatePath(`/events/${eventId}`, "layout");
  return { assistantMessage, done: nextQ.done };
}

export async function generatePlanAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  const { categories } = await generateRequirementPlan(event);

  // Meteen ook een conceptbericht per (geselecteerde) categorie klaarzetten
  // — dit is de tekst die straks écht naar leveranciers gaat. De
  // organisator ziet en bewerkt 'm op /events/[id]/plan, vóórdat er iets
  // verstuurd wordt (zie RequirementDraftEditor.tsx). Nooit laten falen op
  // een AI-hikje: zonder conceptbericht valt de kaart gewoon terug op de
  // kale categorienaam, zoals voorheen.
  let categoriesWithDrafts = categories;
  try {
    const { messagesByCategory } = await draftSupplierMessages(event, categories);
    categoriesWithDrafts = categories.map((c) => ({ ...c, draftMessage: messagesByCategory.get(c.categoryKey) ?? null }));
  } catch (err) {
    console.error("[generatePlanAction] conceptberichten genereren mislukt, ga door zonder concept.", err);
  }
  await setRequirements(eventId, categoriesWithDrafts);

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
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  await toggleRequirementSelection(eventId, categoryId, selected);
  revalidatePath(`/events/${eventId}`, "layout");
}

/**
 * Slaat een handmatige aanpassing van het AI-conceptbericht op (zie
 * RequirementDraftEditor.tsx op /events/[id]/plan) — dit is precies de
 * tekst die straks als `desiredService` meegaat zodra de organisator de
 * aanvraag voor deze categorie verstuurt.
 */
export async function updateRequirementDraftAction(eventId: string, categoryId: string, draftMessage: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  await updateRequirementDraftMessage(eventId, categoryId, draftMessage);
}

export async function confirmRequirementsAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

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
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");
  if (!text.trim()) return;

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

/**
 * Sluit een evenement handmatig (stage -> "cancelled"). Dit verwijdert géén
 * data — het evenement blijft gewoon zichtbaar in "Mijn evenementen", maar
 * telt niet langer mee voor automatische herinneringen (verlopen
 * reactietermijnen, naderende deadlines, budgetoverschrijding).
 */
/**
 * Zet (of wijzigt) de datum van een evenement — bedoeld voor de "Datum
 * toevoegen"-snelkoppeling die overal verschijnt waar nog geen datum is
 * ingevuld (evenementenlijst, evenement-header). `date` komt rechtstreeks
 * uit een `<input type="date">`, dus al in `YYYY-MM-DD`-formaat — precies
 * wat `EventCore.date` verwacht.
 */
export async function updateEventDateAction(eventId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  const date = String(formData.get("date") ?? "").trim();
  await updateEvent(eventId, { date: date || null });
  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/events");
}

export async function closeEventAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  await updateEvent(eventId, { stage: "cancelled" });
  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/events");
}

/** Heropent een gesloten evenement — zet de stage terug naar "planning". */
export async function reopenEventAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  await updateEvent(eventId, { stage: "planning" });
  revalidatePath(`/events/${eventId}`, "layout");
  revalidatePath("/events");
}

/**
 * Verwijdert een evenement definitief, inclusief alle gekoppelde data
 * (notities, aanvragen, offertes, berichten, betalingen, gasten, ...).
 * Onomkeerbaar — de UI vraagt hier expliciet bevestiging voor.
 */
export async function deleteEventAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  await deleteEvent(eventId);
  revalidatePath("/events");
  redirect("/events");
}
