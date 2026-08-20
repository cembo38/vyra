"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  addSupplierFavorite,
  getEvent,
  markAllNotificationsRead,
  markNotificationRead,
  removeSupplierFavorite,
  toggleTaskDone,
  toggleTimelineDone,
} from "@/lib/data/store";

/**
 * Controleerde tot nu toe nergens wie er aanriep, of dat diegene ook echt
 * eigenaar van het evenement was — een Server Action is los aan te roepen
 * met elke eventId/taskId, ongeacht welke pagina 'm daadwerkelijk toonde.
 * RLS op `event_tasks`/`event_timeline` blokkeert de rijmutatie zelf al
 * (eigenaar-only policy), maar zonder deze check hier geeft de actie geen
 * enkele terugmelding daarover — zelfde soort defense-in-depth-check als
 * overal elders (event-actions.ts, marketplace-actions.ts).
 */
export async function toggleTaskAction(eventId: string, taskId: string, done: boolean) {
  const user = await getCurrentUser();
  if (!user) return;
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) return;

  await toggleTaskDone(eventId, taskId, done);
  revalidatePath(`/events/${eventId}`, "layout");
}

export async function toggleTimelineAction(eventId: string, itemId: string, done: boolean) {
  const user = await getCurrentUser();
  if (!user) return;
  const event = await getEvent(eventId);
  if (!event || event.ownerId !== user.id) return;

  await toggleTimelineDone(eventId, itemId, done);
  revalidatePath(`/events/${eventId}`, "layout");
}

// Bewust de hele root-layout revalideren (i.p.v. alleen "/events") — het
// belletje (en nu ook de volledige notificatiepagina) staat zowel in het
// organisator- als het leveranciersportaal, dus een gelezen/ongelezen-
// wijziging moet overal bijwerken, niet alleen in de organisator-nav.
//
// `userId` kwam tot nu toe rechtstreeks van de aanroeper, zonder enige
// controle dat dit ook echt de ingelogde gebruiker was — een Server Action
// aanroepen met een ANDER account se userId zou (afgezien van RLS) diens
// notificatie(s) als gelezen kunnen markeren. We gebruiken nu altijd het
// ID van de daadwerkelijk ingelogde gebruiker; de meegegeven `userId` dient
// alleen nog als extra check dat de aanroepende component niet in de war is.
export async function markNotificationReadAction(userId: string, notificationId: string) {
  const user = await getCurrentUser();
  if (!user || user.id !== userId) return;

  await markNotificationRead(user.id, notificationId);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(userId: string) {
  const user = await getCurrentUser();
  if (!user || user.id !== userId) return;

  await markAllNotificationsRead(user.id);
  revalidatePath("/", "layout");
}

/**
 * Favoriete leverancier toggelen (spec-item #54: organisatoren laten
 * terugkeren). Zelfde vorm als `toggleSupplierBlockedDateAction` — geeft
 * `{ ok, error? }` terug i.p.v. te redirecten, zodat de knop op de
 * profielpagina en de "Mijn leveranciers"-lijst zonder volledige
 * pagina-navigatie kunnen bijwerken.
 */
export async function toggleSupplierFavoriteAction(supplierId: string, favorited: boolean): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  if (favorited) {
    await addSupplierFavorite(user.id, supplierId);
  } else {
    await removeSupplierFavorite(supplierId);
  }

  revalidatePath(`/leveranciers/${supplierId}`);
  revalidatePath("/mijn-leveranciers");
  return { ok: true };
}
