"use server";

import { parseSupplierOfferDescription } from "@/lib/ai/supplierOffer";

export async function generateSupplierOfferPreviewAction(description: string) {
  if (!description.trim()) return null;
  const { data } = await parseSupplierOfferDescription(description);
  return data;
}
