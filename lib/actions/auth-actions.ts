"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { signUpWithPassword, signInWithPassword, signOut, getCurrentUser, requestPasswordReset, updatePassword } from "@/lib/auth";
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

/**
 * Bouwt de retry-URL voor een mislukte signup-poging, met alle velden
 * behalve het wachtwoord teruggegeven als queryparams — /signup/page.tsx
 * gebruikt die als `defaultValue`/`defaultChecked` om het formulier
 * voorgevuld te tonen. Hiervoor moest de gebruiker bij elke validatiefout
 * (bv. per ongeluk beide rol-vinkjes uitgelaten, waar geen `required` op
 * zit) het hele formulier — naam, e-mail, wachtwoord — opnieuw intypen.
 */
function signupRetryParams(params: {
  error: string;
  firstName: string;
  lastName: string;
  email: string;
  asOrganizer: boolean;
  asSupplier: boolean;
}): string {
  const qs = new URLSearchParams({
    error: params.error,
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
    asOrganizer: params.asOrganizer ? "1" : "0",
    asSupplier: params.asSupplier ? "1" : "0",
  });
  return `/signup?${qs.toString()}`;
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const consent = formData.get("consent");
  const asOrganizer = formData.get("asOrganizer") === "on";
  const asSupplier = formData.get("asSupplier") === "on";
  const retryParams = (error: string) => signupRetryParams({ error, firstName, lastName, email, asOrganizer, asSupplier });

  if (!asOrganizer && !asSupplier) redirect(retryParams("role"));
  if (!consent) redirect(retryParams("consent"));
  if (!email || password.length < 8) redirect(retryParams("password"));

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
  if (error) redirect(retryParams(authErrorCode(error)));

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

/**
 * Start de "wachtwoord vergeten"-e-mail. Stuurt ALTIJD naar dezelfde
 * bevestigingspagina, ongeacht of dit e-mailadres echt bij een account
 * hoort (zie requestPasswordReset() in lib/auth.ts) — zo kan deze pagina
 * niet gebruikt worden om te achterhalen welke e-mailadressen een
 * Vyra-account hebben.
 */
export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/wachtwoord-vergeten?error=email_missing");

  const origin = await siteOrigin();
  await requestPasswordReset(email, `${origin}/auth/callback?next=/wachtwoord-vergeten/nieuw`);
  redirect(`/wachtwoord-vergeten/verzonden?email=${encodeURIComponent(email)}`);
}

/**
 * Zet het nieuwe wachtwoord — vereist een geldige sessie, die alleen tot
 * stand komt door eerst op de link in de reset-mail te klikken (die de
 * gebruiker via /auth/callback hier laat landen, al ingelogd). We loggen
 * bewust weer uit na het opslaan en sturen naar /login, in plaats van de
 * herstel-sessie stilzwijgend als "gewoon ingelogd" te laten doorlopen —
 * een korte, verwachte stap die meteen bevestigt dat het nieuwe wachtwoord
 * ook echt werkt.
 */
export async function updatePasswordAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/wachtwoord-vergeten?error=expired");

  const password = String(formData.get("password") ?? "");
  const passwordRepeat = String(formData.get("passwordRepeat") ?? "");
  if (password.length < 8) redirect("/wachtwoord-vergeten/nieuw?error=password");
  if (password !== passwordRepeat) redirect("/wachtwoord-vergeten/nieuw?error=mismatch");

  const { error } = await updatePassword(password);
  if (error) redirect(`/wachtwoord-vergeten/nieuw?error=${authErrorCode(error)}`);

  await signOut();
  redirect("/login?resetSuccess=1");
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
