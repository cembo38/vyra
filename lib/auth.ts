import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data/store";
import { UserAccount } from "@/lib/types";

/**
 * Echte authenticatie via Supabase Auth met e-mail + wachtwoord.
 * `getCurrentUser()` geeft `null` terug als niemand is ingelogd; de callers
 * (layouts/pages) sturen dan door naar /login.
 *
 * Geblokkeerde gebruikers (admin-actie, zie lib/actions/admin-actions.ts)
 * worden hier meteen uitgelogd en doorgestuurd naar /login met een
 * duidelijke melding — dit is bewust de ENIGE plek waar dat gebeurt, zodat
 * elke pagina die al `if (!user) redirect(...)` doet dit automatisch mee
 * afdwingt, zonder dat we die check overal apart hoeven toe te voegen. Dit
 * is veilig tegen een oneindige doorstuurlus: /login zelf roept
 * `getCurrentUser()` nergens aan (gecontroleerd), dus de redirect hieronder
 * komt altijd tot rust op de inlogpagina.
 */
export async function getCurrentUser(): Promise<UserAccount | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const account = await getUser(user.id);
  if (account?.bannedAt) {
    await signOut();
    redirect("/login?error=banned");
  }
  return account;
}

/**
 * Sentinel-foutwaarde voor "Supabase is niet geconfigureerd (of de
 * omgevingsvariabelen kloppen niet)" — geëxporteerd zodat
 * lib/actions/auth-actions.ts 'm exact kan herkennen in authErrorCode() en
 * er een duidelijke Nederlandse melding aan kan koppelen.
 *
 * BEWUST geen throw (zoals hiervoor): dit gebeurt op de meest kritieke plek
 * in de hele app — inloggen/registreren zelf — en zou anders een
 * onafgehandelde crash in de server action veroorzaken. Voor de gebruiker
 * zag dat eruit als "de inlogknop doet he­lemaal niets": geen foutmelding,
 * geen redirect, gewoon stilte (livegang-incident aug. 2026, waarschijnlijk
 * veroorzaakt doordat de Supabase-omgevingsvariabelen in Vercel per ongeluk
 * zijn gewijzigd/verwijderd terwijl de Stripe-sleutels ernaast werden
 * toegevoegd). Alle vier de aanroepers hieronder hebben al een bestaand
 * `{ error: string | null }`-contract — deze sentinel hergebruikt dat
 * gewoon, in plaats van er als enige plek in dit bestand een uitzondering
 * op te maken.
 */
export const AUTH_NOT_CONFIGURED_ERROR = "AUTH_NOT_CONFIGURED";

/**
 * Maakt een account aan met e-mail + wachtwoord. De database-trigger
 * `handle_new_user` maakt meteen het bijbehorende profiel aan (zie
 * supabase/migrations/0001_init.sql).
 *
 * `confirmedSession` geeft aan of er meteen een sessie is (dus meteen
 * ingelogd, geen e-mailstap nodig) — dat hangt af van of "Confirm email"
 * uitstaat in de Supabase-instellingen. Staat die nog aan, dan is er geen
 * sessie en moet de gebruiker eerst de bevestigingsmail openen.
 */
export async function signUpWithPassword(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "customer" | "supplier" | "both";
  emailRedirectTo: string;
  /** Referral-programma (migratie 0045) — id van de uitnodigende gebruiker, gelezen door handle_new_user() en gevalideerd/opgeslagen als profiles.referred_by. */
  referredBy?: string | null;
}): Promise<{ error: string | null; confirmedSession: boolean; userId: string | null }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: AUTH_NOT_CONFIGURED_ERROR, confirmedSession: false, userId: null };

  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      emailRedirectTo: params.emailRedirectTo,
      data: {
        first_name: params.firstName,
        last_name: params.lastName,
        role: params.role,
        ...(params.referredBy ? { referred_by: params.referredBy } : {}),
      },
    },
  });
  if (error) return { error: error.message, confirmedSession: false, userId: null };
  return { error: null, confirmedSession: !!data.session, userId: data.user?.id ?? null };
}

export async function signInWithPassword(email: string, password: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: AUTH_NOT_CONFIGURED_ERROR };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { error: null };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

/**
 * Start het "wachtwoord vergeten"-e-mailtraject. Geeft bewust ALTIJD
 * `{ error: null }` terug als er geen harde Supabase-fout optreedt — of het
 * e-mailadres daadwerkelijk bij een account hoort, laten we in het midden
 * (zie de aanroepende actie), zodat deze pagina niet gebruikt kan worden om
 * te achterhalen welke e-mailadressen een Vyra-account hebben.
 */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: AUTH_NOT_CONFIGURED_ERROR };

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Zet een nieuw wachtwoord voor de op dit moment ingelogde gebruiker. Wordt
 * alleen aangeroepen nadat de reset-link (via /auth/callback) al een echte
 * sessie heeft opgezet — er is dus altijd al een ingelogde gebruiker
 * wanneer dit wordt aangeroepen (zie updatePasswordAction).
 */
export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: AUTH_NOT_CONFIGURED_ERROR };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { error: null };
}
