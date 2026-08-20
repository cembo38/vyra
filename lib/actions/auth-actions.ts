"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { signUpWithPassword, signInWithPassword, signOut, getCurrentUser } from "@/lib/auth";
import { updateUser, getSupplierAccountByOwner } from "@/lib/data/store";

async function siteOrigin() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

/**
 * Vertaalt een Supabase Auth-foutmelding naar een korte errorcode voor in de
 * URL, zodat de login-/aanmeldpagina een nette Nederlandse melding kan tonen
 * i.p.v. een onbehandelde crash (de generieke Next.js-foutpagina met een
 * cijfercode).
 */
function authErrorCode(message: string): string {
  if (/already registered|already exists/i.test(message)) return "already_registered";
  if (/invalid login credentials/i.test(message)) return "invalid_credentials";
  if (/email not confirmed/i.test(message)) return "not_confirmed";
  if (/password.*(least|short|weak)/i.test(message)) return "password";
  if (/rate limit/i.test(message)) return "ratelimit";
  return "send_failed";
}

/** Stuurt een net ingelogde gebruiker naar de juiste plek: leveranciersprofiel afronden, of meteen naar zijn/haar eigen pagina. */
async function redirectAfterAuth(): Promise<never> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=send_failed");

  if (user.role === "supplier" || user.role === "both") {
    const supplier = await getSupplierAccountByOwner(user.id);
    redirect(supplier ? "/supplier/dashboard" : "/supplier/onboarding");
  }
  redirect("/events");
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const consent = formData.get("consent");
  const asOrganizer = formData.get("asOrganizer") === "on";
  const asSupplier = formData.get("asSupplier") === "on";

  if (!asOrganizer && !asSupplier) redirect("/signup?error=role");
  if (!consent) redirect("/signup?error=consent");
  if (!email || password.length < 8) redirect("/signup?error=password");

  const role = asOrganizer && asSupplier ? "both" : asSupplier ? "supplier" : "customer";
  const origin = await siteOrigin();
  const { error, confirmedSession } = await signUpWithPassword({
    email,
    password,
    firstName,
    lastName,
    role,
    emailRedirectTo: `${origin}/auth/callback`,
  });
  if (error) redirect(`/signup?error=${authErrorCode(error)}`);

  if (!confirmedSession) {
    // "Confirm email" staat nog aan in Supabase — pas na het klikken op de
    // link in de mail is er een sessie. Zodra dat uitstaat, komt dit pad
    // nooit meer voor en ga je hierboven meteen door naar je eigen pagina.
    redirect(`/signup/check-email?email=${encodeURIComponent(email)}`);
  }

  revalidatePath("/", "layout");
  await redirectAfterAuth();
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=missing");

  const { error } = await signInWithPassword(email, password);
  if (error) redirect(`/login?error=${authErrorCode(error)}`);

  await redirectAfterAuth();
}

export async function completeOnboardingAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const country = String(formData.get("country") ?? "NL");
  const language = String(formData.get("language") ?? "nl") as "nl" | "en";
  const currency = String(formData.get("currency") ?? "EUR");
  await updateUser(user!.id, { firstName, lastName, country, language, currency });
  revalidatePath("/", "layout");
  redirect("/events");
}

export async function updateProfileAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const country = String(formData.get("country") ?? "NL");
  const language = String(formData.get("language") ?? "nl") as "nl" | "en";
  const currency = String(formData.get("currency") ?? "EUR");
  await updateUser(user!.id, { firstName, lastName, country, language, currency });
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}

/**
 * Rolkeuze achteraf wijzigen via /profile — bugfix + uitbreiding: bij
 * /signup werd deze keuze al gevraagd (organisator/leverancier/allebei),
 * maar landde die door een ontbrekende koppeling in de database-trigger
 * (zie migratie 0023) nooit echt op het profiel — iedereen kreeg
 * stilzwijgend "organisator". Zelfde twee-checkboxes-patroon en dezelfde
 * berekening als `signupAction` hierboven, zodat beide plekken altijd
 * hetzelfde resultaat opleveren voor dezelfde keuze.
 *
 * Whitelist bewust tegen alleen 'customer'/'supplier'/'both' — 'admin' is
 * hier nooit een geldige uitkomst, want adminrechten lopen uitsluitend via
 * ADMIN_EMAILS (lib/config.ts) en hebben niets met deze kolom te maken.
 * Dit is puur een label + een hint voor de na-login-redirect
 * (`redirectAfterAuth` hierboven); het regelt zelf geen toegang tot het
 * leveranciersportaal — dat blijft, zoals nu al, gaan via het bestaan van
 * een echt leveranciersprofiel (`getSupplierAccountByOwner`).
 */
export async function updateRoleAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const asOrganizer = formData.get("asOrganizer") === "on";
  const asSupplier = formData.get("asSupplier") === "on";
  if (!asOrganizer && !asSupplier) redirect("/profile?error=role");

  const role = asOrganizer && asSupplier ? "both" : asSupplier ? "supplier" : "customer";
  await updateUser(user.id, { role });
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}

export async function logoutAction() {
  await signOut();
  redirect("/");
}
