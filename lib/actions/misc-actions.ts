"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  addSupplierFavorite,
  createFavoriteCollection,
  createSavedSearch,
  deleteFavoriteCollection,
  deletePushSubscription,
  deleteSavedSearch,
  getEvent,
  getSavedSearchesForUser,
  listFavoriteCollections,
  markAllNotificationsRead,
  markNotificationRead,
  moveFavoriteToCollection,
  removeSupplierFavorite,
  renameFavoriteCollection,
  savePushSubscription,
  toggleTaskDone,
  toggleTimelineDone,
} from "@/lib/data/store";
import { SupplierCategory, SupplierFavoriteCollection } from "@/lib/types";

const MAX_COLLECTION_NAME_LENGTH = 60;
const MAX_COLLECTIONS_PER_USER = 30;

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

/**
 * Bewaart de huidige zoekfilters van /leveranciers (Vinted-stijl "bewaar
 * deze zoekopdracht") — een leeg filter wordt `null`, zodat "alle
 * categorieën"/"geen locatie" ook echt zo matcht in
 * notifyMatchingSavedSearches() (lib/data/store.ts). Slaat geen exacte
 * duplicaten dubbel op — anders krijgt iemand die twee keer op "Bewaren"
 * klikt straks ook twee identieke meldingen bij elke match.
 */
export async function saveSearchAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/leveranciers");

  const categoryKeyRaw = String(formData.get("category") ?? "").trim();
  const categoryKey = (categoryKeyRaw || null) as SupplierCategory | null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const query = String(formData.get("q") ?? "").trim() || null;

  const existing = await getSavedSearchesForUser(user.id);
  const isDuplicate = existing.some(
    (s) => s.categoryKey === categoryKey && (s.location ?? "") === (location ?? "") && (s.query ?? "") === (query ?? "")
  );
  if (!isDuplicate) {
    await createSavedSearch(user.id, { categoryKey, location, query });
  }
  revalidatePath("/mijn-leveranciers");

  const qs = new URLSearchParams();
  // "categories" (meervoud), niet "category" — zie parseCategories() in
  // app/leveranciers/page.tsx sinds de multi-select categoriebalk.
  if (categoryKey) qs.set("categories", categoryKey);
  if (location) qs.set("location", location);
  if (query) qs.set("q", query);
  qs.set("searchSaved", "1");
  redirect(`/leveranciers?${qs.toString()}`);
}

export async function deleteSavedSearchAction(id: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await deleteSavedSearch(id, user.id);
  revalidatePath("/mijn-leveranciers");
}

/**
 * Genoemde collecties voor favorieten (spec-item #129) — "Mijn
 * leveranciers" was tot nu toe altijd één platte lijst. Zelfde
 * ok/error-vorm als `toggleSupplierFavoriteAction` hierboven, zodat de
 * pagina zonder volledige navigatie kan bijwerken.
 */
export async function createFavoriteCollectionAction(name: string): Promise<{ ok: boolean; error?: string; collection?: SupplierFavoriteCollection }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  const trimmed = name.trim().slice(0, MAX_COLLECTION_NAME_LENGTH);
  if (!trimmed) return { ok: false, error: "Geef de collectie een naam." };

  const existing = await listFavoriteCollections(user.id);
  if (existing.length >= MAX_COLLECTIONS_PER_USER) {
    return { ok: false, error: `Je kunt maximaal ${MAX_COLLECTIONS_PER_USER} collecties aanmaken — verwijder er eerst één.` };
  }
  if (existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, error: "Je hebt al een collectie met deze naam." };
  }

  const collection = await createFavoriteCollection(user.id, trimmed);
  if (!collection) return { ok: false, error: "Aanmaken is niet gelukt, probeer het nogmaals." };

  revalidatePath("/mijn-leveranciers");
  return { ok: true, collection };
}

export async function renameFavoriteCollectionAction(collectionId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  const trimmed = name.trim().slice(0, MAX_COLLECTION_NAME_LENGTH);
  if (!trimmed) return { ok: false, error: "Geef de collectie een naam." };

  const ok = await renameFavoriteCollection(collectionId, user.id, trimmed);
  if (!ok) return { ok: false, error: "Hernoemen is niet gelukt." };

  revalidatePath("/mijn-leveranciers");
  return { ok: true };
}

/** Verwijdert alleen de collectie — favorieten die erin zaten vallen terug op "Niet ingedeeld", ze worden nooit zelf verwijderd. */
export async function deleteFavoriteCollectionAction(collectionId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  await deleteFavoriteCollection(collectionId, user.id);
  revalidatePath("/mijn-leveranciers");
  return { ok: true };
}

export async function moveFavoriteToCollectionAction(supplierId: string, collectionId: string | null): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  const ok = await moveFavoriteToCollection(user.id, supplierId, collectionId);
  if (!ok) return { ok: false, error: "Verplaatsen is niet gelukt." };

  revalidatePath("/mijn-leveranciers");
  return { ok: true };
}

/**
 * Browser-pushmeldingen (spec-item #131) — de browser levert het
 * abonnement (endpoint + sleutels) pas op ná `PushManager.subscribe()`,
 * dus dit MOET vanuit een client component aangeroepen worden (de server
 * kan `PushManager` niet zelf aanroepen). Zelfde ok/error-vorm als de
 * andere acties hier.
 */
export async function savePushSubscriptionAction(sub: { endpoint: string; p256dh: string; authKey: string }): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  if (!sub.endpoint || !sub.p256dh || !sub.authKey) return { ok: false, error: "Ongeldig push-abonnement." };

  const ok = await savePushSubscription(user.id, sub);
  if (!ok) return { ok: false, error: "Opslaan is niet gelukt." };
  return { ok: true };
}

export async function deletePushSubscriptionAction(endpoint: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  await deletePushSubscription(user.id, endpoint);
  return { ok: true };
}
