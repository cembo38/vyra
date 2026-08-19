"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseSupplierOfferDescription } from "@/lib/ai/supplierOffer";
import { getCurrentUser } from "@/lib/auth";
import {
  createSupplierAccount,
  getRequest,
  getSupplierAccountByOwner,
  requestSupplierVerification,
  sendCustomSupplierRequest,
  submitSupplierOffer,
  updateSupplierAccount,
  uploadSupplierFile,
} from "@/lib/data/store";
import { SupplierCategory } from "@/lib/types";

function optionalTrim(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

export async function generateSupplierOfferPreviewAction(description: string) {
  if (!description.trim()) return null;
  const user = await getCurrentUser();
  const { data } = await parseSupplierOfferDescription(description, { userId: user?.id ?? null });
  return data;
}

export async function createSupplierProfileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const existing = await getSupplierAccountByOwner(user!.id);
  if (existing) redirect("/supplier/dashboard");

  const companyName = String(formData.get("companyName") ?? "").trim();
  const contactPerson = String(formData.get("contactPerson") ?? "").trim();
  const categories = formData.getAll("categories").map(String) as SupplierCategory[];
  const categoryOther = optionalTrim(formData.get("categoryOther"));
  const baseLocation = String(formData.get("baseLocation") ?? "").trim();
  const serviceRadiusKm = Number(formData.get("serviceRadiusKm") ?? 25);
  const description = String(formData.get("description") ?? "").trim();
  const minPriceEuros = Number(formData.get("minPrice") ?? 0);
  const avgPriceEuros = Number(formData.get("avgPrice") ?? 0);

  if (!companyName || !contactPerson || categories.length === 0 || !baseLocation || !description) {
    redirect("/supplier/onboarding?error=1");
  }

  await createSupplierAccount(user!.id, {
    companyName,
    contactPerson,
    categories,
    categoryOther,
    baseLocation,
    serviceRadiusKm: Number.isFinite(serviceRadiusKm) && serviceRadiusKm > 0 ? Math.round(serviceRadiusKm) : 25,
    description,
    minPriceCents: Math.round(minPriceEuros * 100),
    avgPriceCents: Math.round(avgPriceEuros * 100),
    kvkNumber: null,
    website: null,
    socialFacebook: null,
    socialInstagram: null,
    socialTiktok: null,
  });

  revalidatePath("/", "layout");
  redirect("/supplier/dashboard");
}

export async function updateSupplierProfileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplier = await getSupplierAccountByOwner(user!.id);
  if (!supplier) redirect("/supplier/onboarding");

  const companyName = String(formData.get("companyName") ?? "").trim();
  const contactPerson = String(formData.get("contactPerson") ?? "").trim();
  const categories = formData.getAll("categories").map(String) as SupplierCategory[];
  const categoryOther = optionalTrim(formData.get("categoryOther"));
  const baseLocation = String(formData.get("baseLocation") ?? "").trim();
  const serviceRadiusKm = Number(formData.get("serviceRadiusKm") ?? 25);
  const description = String(formData.get("description") ?? "").trim();
  const minPriceEuros = Number(formData.get("minPrice") ?? 0);
  const avgPriceEuros = Number(formData.get("avgPrice") ?? 0);
  const kvkNumber = optionalTrim(formData.get("kvkNumber"));
  const website = optionalTrim(formData.get("website"));
  const socialFacebook = optionalTrim(formData.get("socialFacebook"));
  const socialInstagram = optionalTrim(formData.get("socialInstagram"));
  const socialTiktok = optionalTrim(formData.get("socialTiktok"));

  if (!companyName || !contactPerson || categories.length === 0 || !baseLocation || !description) {
    redirect("/supplier/profile?error=1");
  }

  // Logo/foto's zijn optioneel — alleen uploaden als er echt een bestand is
  // gekozen. `uploadSupplierFile` geeft `null` terug bij een mislukte
  // upload (bv. de opslagruimte ontbreekt nog) — dat hield deze actie
  // voorheen stilzwijgend, zonder de gebruiker ooit te laten weten dat er
  // niets is opgeslagen. `uploadFailed` zorgt dat we dat nu wél melden.
  let uploadFailed = false;

  const logoFile = formData.get("logo");
  let logoUrl: string | undefined;
  if (logoFile instanceof File && logoFile.size > 0) {
    const uploaded = await uploadSupplierFile(user!.id, logoFile, "logo");
    if (uploaded) logoUrl = uploaded;
    else uploadFailed = true;
  }

  const galleryFiles = formData.getAll("gallery").filter((f): f is File => f instanceof File && f.size > 0);
  let galleryUrls: string[] | undefined;
  if (galleryFiles.length > 0) {
    const uploaded = await Promise.all(galleryFiles.map((f) => uploadSupplierFile(user!.id, f, "gallery")));
    const succeeded = uploaded.filter((u): u is string => Boolean(u));
    if (succeeded.length < galleryFiles.length) uploadFailed = true;
    galleryUrls = [...supplier!.galleryUrls, ...succeeded];
  }

  await updateSupplierAccount(supplier!.id, {
    companyName,
    contactPerson,
    categories,
    categoryOther,
    baseLocation,
    serviceRadiusKm: Number.isFinite(serviceRadiusKm) && serviceRadiusKm > 0 ? Math.round(serviceRadiusKm) : 25,
    description,
    minPriceCents: Math.round(minPriceEuros * 100),
    avgPriceCents: Math.round(avgPriceEuros * 100),
    kvkNumber,
    website,
    socialFacebook,
    socialInstagram,
    socialTiktok,
    ...(logoUrl ? { logoUrl } : {}),
    ...(galleryUrls ? { galleryUrls } : {}),
  });

  revalidatePath("/supplier", "layout");
  revalidatePath(`/leveranciers/${supplier!.id}`);
  redirect(uploadFailed ? "/supplier/profile?saved=1&uploadError=1" : "/supplier/profile?saved=1");
}

export async function requestSupplierVerificationAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplier = await getSupplierAccountByOwner(user!.id);
  if (!supplier) redirect("/supplier/onboarding");

  // Zonder KVK-nummer heeft een admin niets om te controleren — vraag dat
  // eerst op via het gewone profielformulier.
  if (!supplier!.kvkNumber) redirect("/supplier/profile?verifyError=1");
  if (supplier!.verified || supplier!.verificationRequestedAt) redirect("/supplier/profile");

  await requestSupplierVerification(supplier!.id);

  revalidatePath("/supplier/profile");
  redirect("/supplier/profile?verifyRequested=1");
}

export async function removeSupplierGalleryImageAction(imageUrl: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  await updateSupplierAccount(supplier.id, { galleryUrls: supplier.galleryUrls.filter((u) => u !== imageUrl) });
  revalidatePath("/supplier/profile");
  revalidatePath(`/leveranciers/${supplier.id}`);
}

export async function submitCustomSupplierRequestAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplierId = String(formData.get("supplierId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const categoryKey = String(formData.get("categoryKey") ?? "") as SupplierCategory;
  const desiredService = String(formData.get("desiredService") ?? "").trim();
  const specialRequests = String(formData.get("specialRequests") ?? "").trim();
  const budgetEuros = formData.get("budget") ? Number(formData.get("budget")) : null;

  if (!supplierId || !eventId || !categoryKey || !desiredService) {
    redirect(`/leveranciers/${supplierId}?error=1`);
  }

  await sendCustomSupplierRequest({
    eventId,
    supplierId,
    categoryKey,
    desiredService,
    specialRequests,
    budgetCents: budgetEuros ? Math.round(budgetEuros * 100) : null,
  });

  revalidatePath(`/events/${eventId}`, "layout");
  redirect(`/leveranciers/${supplierId}?requestSent=1`);
}

export async function submitSupplierOfferAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplier = await getSupplierAccountByOwner(user!.id);
  if (!supplier) redirect("/supplier/onboarding");

  const requestId = String(formData.get("requestId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const priceEuros = Number(formData.get("totalPrice") ?? 0);

  if (!requestId || priceEuros <= 0) {
    redirect(`/supplier/requests/${requestId}?error=1`);
  }

  // Belangrijk: eventId/categoryKey NOOIT overnemen uit de (verborgen)
  // formuliervelden die de client meestuurt — die zijn met devtools/curl
  // aan te passen. Haal ze in plaats daarvan server-side op uit de
  // aanvraag zelf, zodat een offerte altijd bij de échte aanvraag hoort
  // waar deze leverancier voor uitgenodigd is, nooit bij een event dat de
  // leverancier zelf in het formulier heeft ingevuld.
  const request = await getRequest(requestId);
  if (!request) redirect(`/supplier/requests/${requestId}?error=1`);
  const eventId = request!.eventId;
  const categoryKey = request!.categoryKey as SupplierCategory;

  const { data: parsed } = await parseSupplierOfferDescription(description, { userId: user!.id, eventId });

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
