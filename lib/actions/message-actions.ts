"use server";

import { revalidatePath } from "next/cache";
import { addMessage, getEvent } from "@/lib/data/store";
import { SupplierCategory } from "@/lib/types";

export async function sendMessageAction(eventId: string, categoryKey: SupplierCategory, supplierId: string, text: string) {
  if (!text.trim()) return;
  const event = await getEvent(eventId);
  if (!event) return;
  await addMessage({ eventId, categoryKey, supplierId, sender: "customer", text: text.trim() });
  revalidatePath(`/events/${eventId}/messages`, "layout");
}
