"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loginOrSignup } from "@/lib/auth";
import { updateUser } from "@/lib/data/store";
import { revalidatePath } from "next/cache";

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!email) return;
  await loginOrSignup(email, { firstName, lastName });
  redirect("/onboarding");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  await loginOrSignup(email);
  redirect("/events");
}

export async function socialAuthAction(formData: FormData) {
  // Mock voor Google/Apple-knoppen: in productie via Supabase Auth OAuth.
  const provider = String(formData.get("provider") ?? "google");
  await loginOrSignup(`demo+${provider}@eventflow.app`, { firstName: "Demo", lastName: "Gebruiker" });
  redirect("/onboarding");
}

export async function completeOnboardingAction(formData: FormData) {
  const userId = String(formData.get("userId"));
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const country = String(formData.get("country") ?? "NL");
  const language = String(formData.get("language") ?? "nl") as "nl" | "en";
  const currency = String(formData.get("currency") ?? "EUR");
  updateUser(userId, { firstName, lastName, country, language, currency });
  revalidatePath("/", "layout");
  redirect("/events");
}

export async function updateProfileAction(formData: FormData) {
  const userId = String(formData.get("userId"));
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const country = String(formData.get("country") ?? "NL");
  const language = String(formData.get("language") ?? "nl") as "nl" | "en";
  const currency = String(formData.get("currency") ?? "EUR");
  updateUser(userId, { firstName, lastName, country, language, currency });
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete("ef_uid");
  redirect("/");
}
