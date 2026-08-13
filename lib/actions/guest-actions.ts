"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { addGuest, addGuestsBulk, deleteGuest, submitRsvpPublic, updateGuest } from "@/lib/data/store";

export async function addGuestAction(eventId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const groupLabel = String(formData.get("groupLabel") ?? "").trim();
  await addGuest(eventId, { name, email: email || null, phone: phone || null, groupLabel: groupLabel || null });
  revalidatePath(`/events/${eventId}/guests`);
}

export async function addGuestsBulkAction(eventId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const raw = String(formData.get("names") ?? "");
  const names = raw.split("\n");
  await addGuestsBulk(eventId, names);
  revalidatePath(`/events/${eventId}/guests`);
}

export async function updateGuestRsvpAction(eventId: string, guestId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const rsvpStatus = formData.get("rsvpStatus");
  if (rsvpStatus !== "pending" && rsvpStatus !== "yes" && rsvpStatus !== "no" && rsvpStatus !== "maybe") return;
  const plusOnesRaw = formData.get("plusOnes");
  await updateGuest(guestId, {
    rsvpStatus,
    plusOnes: plusOnesRaw != null ? Number(plusOnesRaw) || 0 : undefined,
  });
  revalidatePath(`/events/${eventId}/guests`);
}

export async function deleteGuestAction(eventId: string, guestId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await deleteGuest(guestId);
  revalidatePath(`/events/${eventId}/guests`);
}

/** Publieke actie — géén login vereist, wordt aangeroepen vanaf de RSVP-link die de organisator deelt. */
export async function submitPublicRsvpAction(guestId: string, formData: FormData) {
  const status = formData.get("status");
  if (status !== "yes" && status !== "no" && status !== "maybe") return;
  const plusOnes = Number(formData.get("plusOnes") ?? 0) || 0;
  const dietaryNotes = String(formData.get("dietaryNotes") ?? "");
  await submitRsvpPublic(guestId, status, plusOnes, dietaryNotes);
  revalidatePath(`/rsvp/${guestId}`);
}
