"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseSupplierOfferDescription } from "@/lib/ai/supplierOffer";
import { getCurrentUser } from "@/lib/auth";
import { createSupplierAccount, getSupplierAccountByOwner, submitSupplierOffer } from "@/lib/data/store";
import { SupplierCategory } from "@/lib/types";

export async function generateSupplierOfferPreviewAction(description: string) {
  if (!description.trim()) return null;
  const { data } = await parseSupplierOfferDescription(description);
  return data;
}

export async function createSupplierProfileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const existing = await getSupplierAccountByOwner(user!.id);
  if (existing) redirect("/supplier/dashboard");

  const companyName = String(formData.get("companyName") ?? "").trim();
  const contactPerson = String(formData.get("contactPerson") ?? "").trim();
  const category = String(formData.get("category") ?? "") as SupplierCategory;
  const serviceAreas = String(formData.get("serviceAreas") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const description = String(formData.get("description") ?? "").trim();
  const minPriceEuros = Number(formData.get("minPrice") ?? 0);
  const avgPriceEuros = Number(formData.get("avgPrice") ?? 0);

  if (!companyName || !contactPerson || !category || serviceAreas.length === 0 || !description) {
    redirect("/supplier/onboarding?error=1");
  }

  await createSupplierAccount(user!.id, {
    companyName,
    contactPerson,
    category,
    serviceAreas,
    description,
    minPriceCents: Math.round(minPriceEuros * 100),
    avgPriceCents: Math.round(avgPriceEuros * 100),
  });

  revalidatePath("/", "layout");
  redirect("/supplier/dashboard");
}

export async function submitSupplierOfferAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplier = await getSupplierAccountByOwner(user!.id);
  if (!supplier) redirect("/supplier/onboarding");

  const requestId = String(formData.get("requestId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const categoryKey = String(formData.get("categoryKey") ?? "") as SupplierCategory;
  const description = String(formData.get("description") ?? "").trim();
  const priceEuros = Number(formData.get("totalPrice") ?? 0);

  if (!requestId || !eventId || !categoryKey || priceEuros <= 0) {
    redirect(`/supplier/requests/${requestId}?error=1`);
  }

  const { data: parsed } = await parseSupplierOfferDescription(description);

  await submitSupplierOffer({
    supplierId: supplier!.id,
    requestId,
    eventId,
    categoryKey,
    totalPriceCents: Math.round(priceEuros * 100),
    includes: parsed?.includes ?? [],
    excludes: parsed?.excludes ?? [],
    staffIncluded: parsed?.staffIncluded ?? false,
    deliveryIncluded: parsed?.deliveryIncluded ?? false,
    setupIncluded: parsed?.setupIncluded ?? false,
    remarks: parsed?.remarks ?? (description || null),
  });

  revalidatePath("/supplier/requests");
  revalidatePath("/supplier/dashboard");
  redirect("/supplier/requests?sent=1");
}
