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
  updateRequirementBudgets,
  updateRequirementDraftMessage,
} from "@/lib/data/store";
import { extractEventFields, generateNextQuestion } from "@/lib/ai/interview";
import { generateRequirementPlan, generateTimeline, detectRisks, draftSupplierMessages } from "@/lib/ai/planning";
import { detectChangeImpact } from "@/lib/ai/assistant";
import { EVENT_TYPE_LABELS, EventCore } from "@/lib/types";
import { uid } from "@/lib/utils";

/**
 * Past de door de AI geëxtraheerde velden toe op het event, en geeft de
 * (eventueel bijgewerkte) event-state terug — i.p.v. alleen te schrijven en
 * de aanroeper zelf een nieuwe `getEvent()` te laten doen. `updateEvent()`
 * haalt de rij zelf al opnieuw op na het schrijven (zie lib/data/store.ts),
 * dus die waarde hergebruiken scheelt een volledig extra DB-round-trip per
 * interviewbeurt (onderdeel van de "even denken"-snelheidsfix, aug. 2026).
 * Neemt bewust het al-opgehaalde `event`-object aan i.p.v. zelf een
 * `getEvent(eventId)` te doen — de aanroeper heeft dat toch al nodig
 * (login-/eigenaarscheck of net aangemaakt), dus dat was een tweede
 * overbodige lees-round-trip.
 */
async function applyExtractedFields(event: EventCore, extracted: Awaited<ReturnType<typeof extractEventFields>>["data"]): Promise<EventCore> {
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

  if (Object.keys(patch).length === 0) return event;
  const updated = await updateEvent(event.id, patch);
  return updated ?? event;
}

export async function startInterviewAction(description: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await createEvent(user.id, description);

  // Het wegschrijven van het gebruikersbericht en de eerste AI-aanroep
  // hebben niets aan elkaar nodig (extractEventFields krijgt de tekst
  // rechtstreeks mee, niet via een DB-lees) — parallel laten lopen i.p.v.
  // na elkaar scheelt een volledige DB-schrijfronde van de wachttijd
  // ("even denken"-snelheidsfix, aug. 2026).
  const [, { data: extracted }] = await Promise.all([
    addInterviewMessage({ eventId: event.id, role: "user", text: description }),
    extractEventFields(description, { userId: user.id, eventId: event.id }),
  ]);
  // applyExtractedFields() geeft de bijgewerkte event-state al terug (zie
  // hierboven) — geen aparte `getEvent()` meer nodig zoals voorheen, dat was
  // een overbodige derde DB-round-trip binnen deze ene interviewbeurt.
  const updatedEvent = await applyExtractedFields(event, extracted);
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

  // Zelfde snelheidsfix als in startInterviewAction hierboven: het
  // gebruikersbericht wegschrijven en de eerste AI-aanroep hebben niets
  // aan elkaar nodig, dus parallel i.p.v. na elkaar.
  const [, { data: extracted }] = await Promise.all([
    addInterviewMessage({ eventId, role: "user", text: userMessage }),
    extractEventFields(userMessage, { userId: currentEvent.ownerId, eventId }),
  ]);
  // applyExtractedFields() geeft de bijgewerkte event-state al terug — geen
  // aparte `getEvent()` meer nodig zoals voorheen.
  const updatedEvent = await applyExtractedFields(currentEvent, extracted);
  const { data: nextQ } = await generateNextQuestion(updatedEvent, await getInterviewMessages(eventId));

  const assistantMessage = nextQ.done
    ? "Helder — ik denk dat ik nu voldoende weet om een sterk eerste plan te maken. Klik hieronder om je AI-eventplan te bekijken."
    : nextQ.question ?? "Vertel me gerust meer.";

  await addInterviewMessage({ eventId, role: "assistant", text: assistantMessage });
  revalidatePath(`/events/${eventId}`, "layout");
  return { assistantMessage, done: nextQ.done };
}

/**
 * Genereert alleen de categorielijst (locatie/catering/fotografie/…) en
 * slaat die meteen op — géén conceptberichten, tijdlijn of risico's, dat
 * blijft voor `generatePlanAction` hieronder. Cem vroeg hierom (na het
 * "Vyra in Beweging"-voorstel op de marketinghomepage, zie Hero.tsx): hij
 * wil dat de organisator vooraf al ziet welke categorieën de AI voorstelt
 * — zonder daar zelf een knop voor te hoeven indrukken — en pas daarna
 * bewust op "Zie volledige plan" klikt voor de rest (dat is de duurdere
 * stap: 3 extra AI-aanroepen na elkaar). Dit is dus bewust de LICHTE,
 * snelle voorproef; NewEventInterview.tsx roept dit automatisch aan zodra
 * `done` waar wordt.
 */
export async function generatePlanPreviewAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  const { categories } = await generateRequirementPlan(event);
  const saved = await setRequirements(eventId, categories);
  revalidatePath(`/events/${eventId}`, "layout");
  return { categories: saved };
}

export async function generatePlanAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  // Normaal is de categorielijst hier al aanwezig — `generatePlanPreviewAction`
  // hierboven draait automatisch zodra het interview klaar is. Dit blijft
  // wel opnieuw genereren als vangnet (bv. een organisator die via een
  // oude/gedeelde link rechtstreeks hier terechtkomt zonder de voorproef te
  // hebben gezien).
  const existing = await getRequirements(eventId);
  const categories = existing.length > 0 ? existing : (await generateRequirementPlan(event)).categories;

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

/**
 * Slaat de handmatige budgetverdeling op vanaf de schuiven bovenaan de
 * planpagina (BudgetAllocator.tsx) — Cem vroeg hierom nadat bleek dat het
 * AI-plan het opgegeven budget niet altijd goed volgde: hiermee kan de
 * organisator de verdeling over categorieën zelf naar smaak bijstellen,
 * ongeacht wat de AI oorspronkelijk voorstelde.
 */
export async function updateRequirementBudgetsAction(eventId: string, updates: { categoryId: string; estimatedBudgetCents: number }[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  // Nooit ongefilterd doorgeven aan de database — een negatief of niet-
  // numeriek bedrag kan hooguit via een handmatige aanroep buiten de UI om
  // binnenkomen (de sliders zelf klemmen dit al af), maar dit is de plek
  // waar dat hard afgedwongen wordt.
  const clean = updates
    .filter((u) => Number.isFinite(u.estimatedBudgetCents))
    .map((u) => ({ categoryId: u.categoryId, estimatedBudgetCents: Math.max(0, Math.round(u.estimatedBudgetCents)) }));
  if (clean.length === 0) return;

  await updateRequirementBudgets(eventId, clean);
  revalidatePath(`/events/${eventId}`, "layout");
}

/**
 * Cem (aug. 2026): "maak die 500 aanpasbaar. zodat iemand ieder gewenst
 * moment kan wijzigen" — het totaalbudget van een evenement kon tot nu toe
 * alleen bepaald worden via het AI-interview (of impliciet via een notitie,
 * zie addNoteAction hierboven), maar op de budgetpagina zelf ("Totaal
 * budget"-tegel) was het puur weergave. `source: "user"` markeert daarna
 * expliciet dat dit bedrag door de organisator zelf is ingesteld/gewijzigd,
 * niet (meer) door de AI geschat — zelfde patroon als het bestaande
 * `patch.budget = { totalCents, source: "user" }` in addNoteAction.
 */
export async function updateBudgetTotalAction(eventId: string, totalCents: number) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  if (!Number.isFinite(totalCents) || totalCents < 0) return;
  const clean = Math.round(Math.min(totalCents, 100_000_000_00));

  await updateEvent(eventId, { budget: { totalCents: clean, source: "user" } });
  revalidatePath(`/events/${eventId}`, "layout");
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
