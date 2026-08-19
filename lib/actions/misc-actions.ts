"use server";

import { revalidatePath } from "next/cache";
import { markAllNotificationsRead, markNotificationRead, toggleTaskDone, toggleTimelineDone } from "@/lib/data/store";

export async function toggleTaskAction(eventId: string, taskId: string, done: boolean) {
  await toggleTaskDone(eventId, taskId, done);
  revalidatePath(`/events/${eventId}`, "layout");
}

export async function toggleTimelineAction(eventId: string, itemId: string, done: boolean) {
  await toggleTimelineDone(eventId, itemId, done);
  revalidatePath(`/events/${eventId}`, "layout");
}

// Bewust de hele root-layout revalideren (i.p.v. alleen "/events") — het
// belletje (en nu ook de volledige notificatiepagina) staat zowel in het
// organisator- als het leveranciersportaal, dus een gelezen/ongelezen-
// wijziging moet overal bijwerken, niet alleen in de organisator-nav.
export async function markNotificationReadAction(userId: string, notificationId: string) {
  await markNotificationRead(userId, notificationId);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(userId: string) {
  await markAllNotificationsRead(userId);
  revalidatePath("/", "layout");
}
