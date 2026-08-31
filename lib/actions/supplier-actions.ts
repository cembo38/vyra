"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseSupplierOfferDescription } from "@/lib/ai/supplierOffer";
import { getCurrentUser } from "@/lib/auth";
import { geocodeLocation } from "@/lib/geo";
import {
  activateSpotlight,
  blockSupplierDate,
  blockSupplierDateRange,
  consumeBonusSpotlightCredit,
  countSpotlightActivationsThisMonth,
  createSupplierAccount,
  getActiveSpotlightsForSupplier,
  getPendingTierUpgradeRequest,
  getRequest,
  getSupplierAccount,
  getSupplierAccountByOwner,
  getSupplierEffectiveTierDefinition,
  pushNotification,
  regenerateSupplierIcalToken,
  requestSpotlightBoost,
  requestSupplierTierUpgrade,
  requestSupplierVerification,
  resolveEffectiveSupplierTier,
  sendCustomSupplierRequest,
  setSupplierRecurringBlock,
  setSupplierStoreOpen,
  setSupplierSubscriptionTier,
  submitSupplierOffer,
  unblockSupplierDate,
  updateSupplierAccount,
  updateSupplierPackages,
  uploadSupplierFile,
} from "@/lib/data/store";
import { ADMIN_EMAILS, SPOTLIGHT_MONTHLY_QUOTA, SUBSCRIPTION_TIER_ORDER, SUBSCRIPTION_TIERS, SubscriptionTier } from "@/lib/config";
import { SupplierCategory, SupplierPackage, SupplierPackageTier } from "@/lib/types";
import { getVideoEmbedUrl, isValidKvkFormat } from "@/lib/utils";
import { sendNotificationEmail } from "@/lib/email/send";

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

/**
 * Bouwt de retry-URL na een mislukte onboarding-poging, met alle 9 velden
 * teruggegeven als queryparams — /supplier/onboarding/page.tsx gebruikt die
 * om het (lange) formulier voorgevuld te tonen. Hiervoor werden bij een
 * validatiefout (bv. geen categorie aangevinkt, waar geen `required` op
 * zit) bedrijfsnaam, beschrijving, prijzen — alles — gewist, en moest de
 * leverancier het hele formulier opnieuw intypen.
 */
function onboardingRetryParams(fields: {
  companyName: string;
  contactPerson: string;
  categories: string[];
  categoryOther: string | null;
  baseLocation: string;
  serviceRadiusKmRaw: string;
  description: string;
  minPriceRaw: string;
  avgPriceRaw: string;
  kvkNumber: string | null;
}): string {
  const qs = new URLSearchParams({
    error: "1",
    companyName: fields.companyName,
    contactPerson: fields.contactPerson,
    categoryOther: fields.categoryOther ?? "",
    baseLocation: fields.baseLocation,
    serviceRadiusKm: fields.serviceRadiusKmRaw,
    description: fields.description,
    minPrice: fields.minPriceRaw,
    avgPrice: fields.avgPriceRaw,
    kvkNumber: fields.kvkNumber ?? "",
  });
  for (const c of fields.categories) qs.append("categories", c);
  return `/supplier/onboarding?${qs.toString()}`;
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
  const serviceRadiusKmRaw = String(formData.get("serviceRadiusKm") ?? "25");
  const description = String(formData.get("description") ?? "").trim();
  const minPriceRaw = String(formData.get("minPrice") ?? "");
  const avgPriceRaw = String(formData.get("avgPrice") ?? "");
  const serviceRadiusKm = Number(serviceRadiusKmRaw);
  const minPriceEuros = Number(minPriceRaw);
  const avgPriceEuros = Number(avgPriceRaw);
  // "Onboarding: foto + KVK + pakketten-nudge" (livegang-audit) — allebei
  // bewust optioneel, net als bij de latere profielbewerking: een nieuwe
  // leverancier die dit nu meteen invult, hoeft niet nog een keer terug
  // naar het profiel om verificatie aan te kunnen vragen of vertrouwd over
  // te komen op zijn eerste, nog lege profiel.
  const kvkNumber = optionalTrim(formData.get("kvkNumber"));
  const logoFile = formData.get("logo");

  if (!companyName || !contactPerson || categories.length === 0 || !baseLocation || !description) {
    redirect(
      onboardingRetryParams({ companyName, contactPerson, categories, categoryOther, baseLocation, serviceRadiusKmRaw, description, minPriceRaw, avgPriceRaw, kvkNumber })
    );
  }

  // "Locatie op een kaart" — bij onboarding is dit altijd de eerste keer dat
  // deze locatie wordt opgeslagen, dus meteen geocoderen (via het gratis
  // Nominatim, geen account nodig, zie lib/geo.ts). Geeft `null` terug bij
  // een onherkend adres — dat blokkeert de onboarding niet, de leverancier
  // verschijnt dan gewoon zonder marker op de kaart.
  const coords = await geocodeLocation(baseLocation);

  let logoUrl: string | null = null;
  if (logoFile instanceof File && logoFile.size > 0) {
    logoUrl = await uploadSupplierFile(user!.id, logoFile, "logo");
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
    kvkNumber,
    website: null,
    socialFacebook: null,
    socialInstagram: null,
    socialTiktok: null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    logoUrl,
  });

  revalidatePath("/", "layout");
  // Pakketten-nudge (spec: "onboarding foto + KVK + pakketten-nudge"):
  // pakketten zijn pas bewerkbaar vanaf Pro (packagesEnabled, lib/config.ts)
  // — een verse Starter-registratie zou een lege pakkettensectie zien, dus
  // de nudge zit in de dashboard-welkomstmelding i.p.v. hier een formulier
  // te tonen dat toch niets kan opslaan. Zie SupplierDashboardWelcome/
  // app/supplier/(portal)/dashboard/page.tsx.
  redirect("/supplier/dashboard?onboarded=1");
}

export async function updateSupplierProfileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplier = await getSupplierAccountByOwner(user!.id);
  if (!supplier) redirect("/supplier/onboarding");

  const companyName = String(formData.get("companyName") ?? "").trim();
  const contactPerson = String(formData.get("contactPerson") ?? "").trim();
  let categories = formData.getAll("categories").map(String) as SupplierCategory[];
  const categoryOther = optionalTrim(formData.get("categoryOther"));
  const baseLocation = String(formData.get("baseLocation") ?? "").trim();
  let serviceRadiusKm = Number(formData.get("serviceRadiusKm") ?? 25);
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

  // Abonnementsniveau-limieten (spec-item #53-vervolg, SaaS-pivot) — hoeveel
  // categorieën, foto's en hoe ver het werkgebied mag reiken, hangt af van
  // het niveau (of de proefperiode) dat nu voor deze leverancier geldt. Dit
  // vult de UI-beperking op het profielformulier aan met een echte
  // server-side grens, want de UI is met devtools te omzeilen. Overschrijdt
  // een leverancier zijn limiet (bv. na een handmatige downgrade), dan
  // knippen we simpelweg af tot het maximum i.p.v. de héle opslag te
  // blokkeren — de leverancier krijgt een duidelijke melding waarom.
  const tierDefinition = await getSupplierEffectiveTierDefinition(supplier!.id);
  let capApplied = false;
  if (tierDefinition.maxCategories != null && categories.length > tierDefinition.maxCategories) {
    categories = categories.slice(0, tierDefinition.maxCategories);
    capApplied = true;
  }
  if (tierDefinition.maxServiceRadiusKm != null && Number.isFinite(serviceRadiusKm) && serviceRadiusKm > tierDefinition.maxServiceRadiusKm) {
    serviceRadiusKm = tierDefinition.maxServiceRadiusKm;
    capApplied = true;
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
    if (tierDefinition.maxGalleryPhotos != null && galleryUrls.length > tierDefinition.maxGalleryPhotos) {
      galleryUrls = galleryUrls.slice(0, tierDefinition.maxGalleryPhotos);
      capApplied = true;
    }
  }

  // "Profiel aankleden" (spec-vervolg op pakketten) — tagline/coverfoto/video
  // zijn elk vanaf een ander abonnementsniveau bewerkbaar (zie
  // taglineEnabled e.a. in lib/config.ts). De inputs staan alleen op het
  // formulier als het huidige niveau ze vrijgeeft, dus we nemen het veld
  // alleen mee in de patch als het écht is aangeboden — anders zou een
  // ontbrekend (want niet-gerenderd) veld bij elke opslag stilzwijgend een
  // eerder ingevulde waarde overschrijven met leeg, ook na een latere
  // upgrade terug naar een hoger niveau.
  let tagline: string | null | undefined;
  if (tierDefinition.taglineEnabled) {
    tagline = optionalTrim(formData.get("tagline"));
  }

  let coverPhotoUrl: string | undefined;
  if (tierDefinition.coverPhotoEnabled) {
    const coverPhotoFile = formData.get("coverPhoto");
    if (coverPhotoFile instanceof File && coverPhotoFile.size > 0) {
      const uploaded = await uploadSupplierFile(user!.id, coverPhotoFile, "cover");
      if (uploaded) coverPhotoUrl = uploaded;
      else uploadFailed = true;
    }
  }

  let introVideoUrl: string | null | undefined;
  let videoUrlInvalid = false;
  if (tierDefinition.introVideoEnabled) {
    const rawVideoUrl = optionalTrim(formData.get("introVideoUrl"));
    if (rawVideoUrl === null) {
      introVideoUrl = null;
    } else if (getVideoEmbedUrl(rawVideoUrl)) {
      introVideoUrl = rawVideoUrl;
    } else {
      videoUrlInvalid = true;
    }
  }

  // "Locatie op een kaart" — alleen opnieuw geocoderen als de locatie
  // daadwerkelijk is gewijzigd, niet bij elke profielopslag. Dit respecteert
  // Nominatim's fair-use-beleid (het gratis geocoding-alternatief zonder
  // account, zie lib/geo.ts) en voorkomt overbodige externe aanroepen.
  let coords: { lat: number | null; lng: number | null } | undefined;
  if (baseLocation !== supplier!.baseLocation) {
    const geocoded = await geocodeLocation(baseLocation);
    coords = { lat: geocoded?.lat ?? null, lng: geocoded?.lng ?? null };
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
    ...(tagline !== undefined ? { tagline } : {}),
    ...(coverPhotoUrl ? { coverPhotoUrl } : {}),
    ...(introVideoUrl !== undefined ? { introVideoUrl } : {}),
    ...(coords ? coords : {}),
  });

  revalidatePath("/supplier", "layout");
  revalidatePath(`/leveranciers/${supplier!.id}`);
  const params = new URLSearchParams({ saved: "1" });
  if (uploadFailed) params.set("uploadError", "1");
  if (capApplied) params.set("capApplied", "1");
  if (videoUrlInvalid) params.set("videoError", "1");
  redirect(`/supplier/profile?${params.toString()}`);
}

export async function requestSupplierVerificationAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplier = await getSupplierAccountByOwner(user!.id);
  if (!supplier) redirect("/supplier/onboarding");

  // Zonder (geldig) KVK-nummer heeft een admin niets om te controleren —
  // vraag dat eerst op via het gewone profielformulier. `isValidKvkFormat`
  // is een eerste, geautomatiseerde check (precies 8 cijfers) die
  // overduidelijk foute/verzonnen nummers er meteen uitfiltert, vóórdat een
  // admin er handmatig naar kijkt.
  if (!isValidKvkFormat(supplier!.kvkNumber)) redirect("/supplier/profile?verifyError=1");
  if (supplier!.verified || supplier!.verificationRequestedAt) redirect("/supplier/profile");

  await requestSupplierVerification(supplier!.id);

  // Directe bevestiging als in-app-notificatie (i.p.v. alleen een
  // banner die verdwijnt na de volgende paginaverversing) — zo blijft
  // "bedankt, in afwachting van besluit" ook nog terug te vinden in het
  // notificatiepaneel.
  await pushNotification({
    userId: user!.id,
    eventId: null,
    type: "verification_requested",
    title: "Bedankt — je aanvraag is ontvangen",
    body: "We hebben je verificatieaanvraag ontvangen en controleren je bedrijfsgegevens. Je hoort van ons zodra hierover een besluit is genomen.",
    href: "/supplier/profile",
  });

  revalidatePath("/supplier/profile");
  redirect("/supplier/profile?verifyRequested=1");
}

/**
 * Leverancier blokkeert/deblokkeert zelf een datum in zijn kalender (bv.
 * vakantie, elders volgeboekt) — telt vanaf nu mee bij het matchen van
 * nieuwe aanvragen op die datum (`findRealMatchingSuppliers` in store.ts).
 * Geeft een resultaat terug i.p.v. te redirecten: wordt vanuit een client
 * component aangeroepen die zelf de UI direct bijwerkt.
 */
export async function toggleSupplierBlockedDateAction(date: string, blocked: boolean): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) return { ok: false, error: "Geen leveranciersaccount gevonden." };

  // Alleen vandaag en toekomstige datums — een datum in het verleden
  // blokkeren heeft geen effect op matching (die kijkt alleen naar nieuwe
  // aanvragen) en is dus zinloos.
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return { ok: false, error: "Je kunt geen datum in het verleden blokkeren." };

  if (blocked) {
    const result = await blockSupplierDate(supplier.id, date);
    if (!result) return { ok: false, error: "Kon deze datum niet blokkeren." };
  } else {
    await unblockSupplierDate(supplier.id, date);
  }

  revalidatePath("/supplier/calendar");
  return { ok: true };
}

/**
 * Blokkeert een hele reeks datums in één keer (bv. een vakantie van twee
 * weken) — spec-item #54-vervolg. Zelfde vorm/validatie als
 * `toggleSupplierBlockedDateAction`, maar dan voor een periode i.p.v. één dag.
 */
export async function blockSupplierDateRangeAction(startDate: string, endDate: string): Promise<{ ok: boolean; error?: string; dates?: string[] }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) return { ok: false, error: "Geen leveranciersaccount gevonden." };

  const today = new Date().toISOString().slice(0, 10);
  if (startDate < today) return { ok: false, error: "Je kunt geen datum in het verleden blokkeren." };

  const result = await blockSupplierDateRange(supplier.id, startDate, endDate || startDate);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/supplier/calendar");
  return { ok: true, dates: result.dates };
}

/**
 * Structurele weekdag-blokkade ("elke maandag niet beschikbaar") —
 * spec-item #128. Zelfde vorm als `toggleSupplierBlockedDateAction`, maar
 * dan voor een terugkerende weekdag i.p.v. een eenmalige datum. `weekday`:
 * 0=maandag..6=zondag.
 */
export async function toggleSupplierRecurringBlockAction(weekday: number, blocked: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: "Ongeldige weekdag." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) return { ok: false, error: "Geen leveranciersaccount gevonden." };

  const result = await setSupplierRecurringBlock(supplier.id, weekday, blocked);
  if (!result.ok) return { ok: false, error: "Dit is niet gelukt." };

  revalidatePath("/supplier/calendar");
  return { ok: true };
}

/**
 * Vervangt de iCal-abonnement-token van deze leverancier door een nieuwe
 * (spec-item #128) — bv. als de oude URL per ongeluk gedeeld is. De oude
 * abonnement-URL stopt daarna direct met werken in elke agenda-app die 'm
 * gebruikte.
 */
export async function regenerateIcalTokenAction(): Promise<{ ok: boolean; error?: string; token?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) return { ok: false, error: "Geen leveranciersaccount gevonden." };

  const token = await regenerateSupplierIcalToken(supplier.id);
  if (!token) return { ok: false, error: "Kon geen nieuwe link genereren." };

  revalidatePath("/supplier/calendar");
  return { ok: true, token };
}

/**
 * "Winkel open/gesloten" (spec-item #55) — leverancier zet zichzelf
 * tijdelijk onvindbaar in zoeken en matching.
 */
export async function toggleStoreOpenAction(open: boolean): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) return { ok: false, error: "Geen leveranciersaccount gevonden." };

  await setSupplierStoreOpen(supplier.id, open);
  revalidatePath("/supplier/dashboard");
  revalidatePath(`/leveranciers/${supplier.id}`);
  return { ok: true };
}

/**
 * Leverancier kiest zelf een abonnementsniveau (spec-item #53-vervolg,
 * SaaS-pivot) — zelfde vorm als `toggleSupplierBlockedDateAction`. Een
 * self-service keuze zonder automatische incasso; zie
 * `setSupplierSubscriptionTier` in lib/data/store.ts voor de volledige
 * toelichting.
 *
 * FIX (livegang-audit augustus 2026): dit liet een leverancier voorheen
 * zelf ELK niveau kiezen, dus ook rechtstreeks het hoogste (destijds
 * "Enterprise") — zonder dat er ooit betaald werd. Cem heeft dit expliciet
 * aangemerkt als iets om nu al
 * dicht te timmeren (in tegenstelling tot bv. het abonnementensysteem zelf,
 * wat een bewuste pilotkeuze blijft): downgraden (of hetzelfde niveau
 * kiezen) blijft vrij self-service, maar upgraden naar een hoger niveau dan
 * het huidige kan voorlopig niet meer via deze actie — zie de UI-kant
 * hiervan in SubscriptionTierPicker.tsx ("Work in progress"-knop).
 */
export async function setSubscriptionTierAction(tier: SubscriptionTier): Promise<{ ok: boolean; error?: string }> {
  if (!SUBSCRIPTION_TIER_ORDER.includes(tier)) return { ok: false, error: "Onbekend abonnementsniveau." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) return { ok: false, error: "Geen leveranciersaccount gevonden." };

  const currentIndex = SUBSCRIPTION_TIER_ORDER.indexOf(supplier.subscriptionTier);
  const requestedIndex = SUBSCRIPTION_TIER_ORDER.indexOf(tier);
  if (requestedIndex > currentIndex) {
    return { ok: false, error: "Upgraden kan nog niet automatisch — dit werken we binnenkort uit. Neem contact met ons op om alvast te upgraden." };
  }

  await setSupplierSubscriptionTier(supplier.id, tier);
  revalidatePath("/supplier/profile");
  revalidatePath(`/leveranciers/${supplier.id}`);
  return { ok: true };
}

/**
 * Zelfbedienings-upgrade-aanvraag (livegang-audit augustus 2026) — het
 * alternatief voor de dode "Work in progress"-knop hierboven. Registreert
 * de aanvraag (Cem keurt 'm goed/af op /admin/leveranciers) en mailt Cem
 * meteen ook zelf, zodat een aanvraag niet onopgemerkt blijft liggen tot
 * de eerstvolgende keer dat hij toevallig het adminpaneel opent.
 */
export async function requestSubscriptionUpgradeAction(tier: SubscriptionTier): Promise<{ ok: boolean; error?: string }> {
  if (!SUBSCRIPTION_TIER_ORDER.includes(tier)) return { ok: false, error: "Onbekend abonnementsniveau." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) return { ok: false, error: "Geen leveranciersaccount gevonden." };

  const currentIndex = SUBSCRIPTION_TIER_ORDER.indexOf(supplier.subscriptionTier);
  const requestedIndex = SUBSCRIPTION_TIER_ORDER.indexOf(tier);
  if (requestedIndex <= currentIndex) return { ok: false, error: "Dit is geen upgrade ten opzichte van je huidige niveau." };

  const existing = await getPendingTierUpgradeRequest(supplier.id);
  if (existing) return { ok: false, error: "Je hebt al een openstaande upgrade-aanvraag — we nemen zo snel mogelijk contact op." };

  const request = await requestSupplierTierUpgrade(supplier.id, tier);
  if (!request) return { ok: false, error: "Aanvragen is niet gelukt. Probeer het nog eens." };

  const tierLabel = SUBSCRIPTION_TIERS[tier].label;
  for (const adminEmail of ADMIN_EMAILS) {
    await sendNotificationEmail({
      to: adminEmail,
      title: `Upgrade-aanvraag: ${supplier.companyName} → ${tierLabel}`,
      body: `${supplier.companyName} (nu: ${SUBSCRIPTION_TIERS[supplier.subscriptionTier].label}) vraagt een upgrade naar ${tierLabel} aan. Beoordeel dit op het adminpaneel.`,
      href: "/admin/leveranciers",
    });
  }

  revalidatePath("/supplier/profile");
  return { ok: true };
}

/**
 * Leverancier zet één van zijn eigen categorieën 3 dagen "in de spotlight"
 * (hoger + met badge in de openbare /leveranciers-zoekresultaten) — zelfde
 * `{ ok, error }`-vorm als `setSubscriptionTierAction`. Beschikbaar vanaf
 * Pro, met een oplopende maandelijkse limiet (zie SPOTLIGHT_MONTHLY_QUOTA in
 * lib/config.ts) — tijdens de proefperiode krijgt een leverancier, net als
 * bij de rest van het platform, de hoogste hoeveelheid (hoger dan zelfs
 * Premium, zie de toelichting bij SPOTLIGHT_MONTHLY_QUOTA).
 */
export async function activateSpotlightAction(categoryKey: SupplierCategory): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) return { ok: false, error: "Geen leveranciersaccount gevonden." };

  if (!(supplier.categories as string[]).includes(categoryKey)) {
    return { ok: false, error: "Dit is niet een van je eigen categorieën." };
  }

  const active = await getActiveSpotlightsForSupplier(supplier.id);
  if (active.some((s) => s.categoryKey === categoryKey)) {
    return { ok: false, error: "Deze categorie staat al in de spotlight." };
  }

  const tier = await resolveEffectiveSupplierTier(supplier.id);
  const quota = SPOTLIGHT_MONTHLY_QUOTA[tier];
  const usedThisMonth = quota > 0 ? await countSpotlightActivationsThisMonth(supplier.id) : 0;
  // Referral-beloningen en goedgekeurde losse boost-aanvragen geven
  // bonus_spotlight_credits — die gelden OOK voor een leverancier zonder
  // eigen quotum (Starter/Groei), en worden hier altijd EERST verbruikt
  // vóór het gewone maandquotum wordt aangesproken (zie
  // consumeBonusSpotlightCredit in lib/data/store.ts).
  const usedBonusCredit = quota <= 0 || usedThisMonth >= quota ? await consumeBonusSpotlightCredit(supplier.id) : false;

  if (!usedBonusCredit) {
    if (quota <= 0) {
      return { ok: false, error: "Spotlights zijn beschikbaar vanaf het Pro-abonnement, of via een losse boost-aanvraag (zie hieronder)." };
    }
    if (usedThisMonth >= quota) {
      return { ok: false, error: `Je hebt je limiet van ${quota} spotlight${quota !== 1 ? "s" : ""} deze maand al gebruikt. Vraag hieronder een losse boost aan, of wacht tot volgende maand.` };
    }
  }

  const spotlight = await activateSpotlight(supplier.id, categoryKey);
  if (!spotlight) return { ok: false, error: "Activeren is niet gelukt. Probeer het nog eens." };

  revalidatePath("/supplier/profile");
  revalidatePath("/supplier/marketing");
  revalidatePath("/leveranciers");
  revalidatePath(`/leveranciers/${supplier.id}`);
  return { ok: true };
}

/**
 * "Losse Spotlight-boost" (livegang-audit) — self-service AANVRAAG, geen
 * directe activatie: Vyra verwerkt nog geen betalingen zelf, zie de
 * uitleg bij requestSpotlightBoost() in lib/data/store.ts.
 */
export async function requestSpotlightBoostAction(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) return { ok: false, error: "Geen leveranciersaccount gevonden." };

  const request = await requestSpotlightBoost(supplier.id);
  if (!request) return { ok: false, error: "Je hebt al een openstaande boost-aanvraag — die wordt binnenkort beoordeeld." };

  revalidatePath("/supplier/marketing");
  return { ok: true };
}

/**
 * Leverancier stelt tot 3 vaste pakketten (Basis/Standaard/Premium) samen —
 * spec-item "pakketten i.p.v. een platte lijst" (Fiverr/Etsy-stijl,
 * beschikbaar vanaf Pro, zie packagesEnabled in lib/config.ts). Zelfde
 * formuliervorm (plain <form action>) als updateSupplierProfileAction, dus
 * ook hetzelfde redirect-patroon i.p.v. { ok, error }.
 */
export async function updateSupplierPackagesAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplier = await getSupplierAccountByOwner(user!.id);
  if (!supplier) redirect("/supplier/onboarding");

  // Server-side poort, net als bij de categorie-/foto-limieten hierboven:
  // de UI toont het formulier al niet zonder packagesEnabled, maar dat is
  // met devtools te omzeilen.
  const tierDefinition = await getSupplierEffectiveTierDefinition(supplier!.id);
  if (!tierDefinition.packagesEnabled) redirect("/supplier/profile");

  const tierKeys: SupplierPackageTier[] = ["basis", "standaard", "premium"];
  const packages: SupplierPackage[] = [];
  for (const tier of tierKeys) {
    const name = String(formData.get(`package_${tier}_name`) ?? "").trim();
    if (!name) continue; // lege naam = dit niveau bewust niet aanbieden
    const description = String(formData.get(`package_${tier}_description`) ?? "").trim();
    const priceEuros = Number(formData.get(`package_${tier}_price`) ?? 0);
    if (!Number.isFinite(priceEuros) || priceEuros <= 0) continue;
    packages.push({ tier, name, description, priceCents: Math.round(priceEuros * 100) });
  }

  await updateSupplierPackages(supplier!.id, packages);
  revalidatePath("/supplier/profile");
  revalidatePath(`/leveranciers/${supplier!.id}`);
  redirect("/supplier/profile?packagesSaved=1");
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

  // Verdediging in de diepte: de knop staat al niet op de pagina als de
  // leverancier "gesloten" is (spec-item #55), maar een verlopen/gecachte
  // pagina zou de form toch nog kunnen tonen — dus hier nogmaals checken.
  const targetSupplier = await getSupplierAccount(supplierId);
  if (!targetSupplier || !targetSupplier.storeOpen) {
    redirect(`/leveranciers/${supplierId}?closedError=1`);
  }

  const request = await sendCustomSupplierRequest({
    eventId,
    supplierId,
    categoryKey,
    desiredService,
    specialRequests,
    budgetCents: budgetEuros ? Math.round(budgetEuros * 100) : null,
  });
  // Het aanmaken kan mislukken (bv. een database-fout) — dat werd hiervoor
  // genegeerd, waardoor de organisator altijd naar de "verstuurd"-melding
  // werd doorgestuurd, ook als er in werkelijkheid niets is aangemaakt.
  if (!request) redirect(`/leveranciers/${supplierId}?error=1`);

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
