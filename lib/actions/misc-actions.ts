"use server";

import { revalidatePath } from "next/cache";
import { markNotificationRead, toggleTaskDone, toggleTimelineDone } from "@/lib/data/store";

export async function toggleTaskAction(eventId: string, taskId: string, done: boolean) {
  await toggleTaskDone(eventId, taskId, done);
  revalidatePath(`/events/${eventId}`, "layout");
}

export async function toggleTimelineAction(eventId: string, itemId: string, done: boolean) {
  await toggleTimelineDone(eventId, itemId, done);
  revalidatePath(`/events/${eventId}`, "layout");
}

export async function markNotificationReadAction(userId: string, notificationId: string) {
  await markNotificationRead(userId, notificationId);
  revalidatePath("/events", "layout");
}
