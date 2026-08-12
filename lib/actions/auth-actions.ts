"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { sendMagicLink, signOut, getCurrentUser } from "@/lib/auth";
import { updateUser } from "@/lib/data/store";

async function siteOrigin() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

/**
 * Vertaalt een Supabase Auth-fout naar een korte errorcode voor in de URL,
 * zodat de loginpagina een nette Nederlandse melding kan tonen i.p.v. een
 * onbehandelde crash (de generieke Next.js-foutpagina met een cijfercode).
 */
function authErrorCode(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/rate limit/i.test(message)) return "ratelimit";
  return "send_failed";
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const consent = formData.get("consent");
  const role = formData.get("role") === "supplier" ? "supplier" : "customer";
  const base = role === "supplier" ? "/supplier/signup" : "/signup";
  if (!consent) redirect(`${base}?error=consent`);
  if (!email) return;
  const origin = await siteOrigin();
  try {
    await sendMagicLink(email, `${origin}/auth/callback`, { firstName, lastName, role });
  } catch (err) {
    redirect(`${base}?error=${authErrorCode(err)}`);
  }
  const checkEmailBase = role === "supplier" ? "/supplier/signup/check-email" : "/signup/check-email";
  redirect(`${checkEmailBase}?email=${encodeURIComponent(email)}`);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  const origin = await siteOrigin();
  try {
    await sendMagicLink(email, `${origin}/auth/callback`);
  } catch (err) {
    redirect(`/login?error=${authErrorCode(err)}`);
  }
  redirect(`/login/check-email?email=${encodeURIComponent(email)}`);
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

export async function logoutAction() {
  await signOut();
  redirect("/");
}
