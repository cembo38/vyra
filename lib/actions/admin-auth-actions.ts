"use server";

import { redirect } from "next/navigation";
import { signInWithPassword, signOut, getCurrentUser } from "@/lib/auth";
import { ADMIN_EMAILS } from "@/lib/config";

/**
 * Los inlogpad voor /admin (spec-item #52 vervolg — "aparte admin
 * omgeving"). Gebruikt dezelfde onderliggende Supabase-account als de
 * rest van Vyra (er is geen apart admin-gebruikersstelsel — dat zou een
 * tweede wachtwoord/account betekenen dat Cem apart moet onthouden), maar
 * met een eigen inlogscherm en een striktere check: alleen een adres uit
 * `ADMIN_EMAILS` komt door.
 *
 * Bewust dezelfde, generieke foutmelding voor drie verschillende situaties
 * (verkeerd wachtwoord, onbekend e-mailadres, of een correct wachtwoord op
 * een e-mailadres dat geen admin is) — zo kan iemand die het probeert niet
 * afleiden welke van de drie het was. Bij de laatste situatie (geldige
 * inlog, maar geen admin) loggen we de sessie meteen weer uit: zo blijft
 * er nooit een ingelogde-maar-niet-admin-sessie hangen op /admin/login.
 */
export async function adminLoginAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { ok: false, error: "Vul e-mailadres en wachtwoord in." };

  const GENERIC_ERROR = "Onjuist e-mailadres of wachtwoord, of dit account heeft geen adminrechten.";

  const { error } = await signInWithPassword(email, password);
  if (error) return { ok: false, error: GENERIC_ERROR };

  const user = await getCurrentUser();
  if (!user || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    await signOut();
    return { ok: false, error: GENERIC_ERROR };
  }

  redirect("/admin");
}

export async function adminLogoutAction() {
  await signOut();
  redirect("/admin/login");
}
