import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase-client — omzeilt Row Level Security volledig.
 *
 * Hoofdregel: ALLEEN gebruiken binnen /admin (en pas ná de
 * ADMIN_EMAILS-check), nooit voor gewone gebruikersacties en nooit
 * client-side (vandaar de "server-only" import bovenaan, die een
 * build-fout geeft als dit bestand per ongeluk in client-code
 * terechtkomt).
 *
 * Eén bewuste, smalle uitzondering: `pushNotification()` in
 * lib/data/store.ts gebruikt 'm om het e-mailadres van de ONTVANGER van
 * een melding op te zoeken (bv. de organisator, terwijl de aanroepende
 * server action als leverancier is ingelogd) — de gewone RLS-client mag
 * andermans profiel niet lezen ("profiles: user reads own"). Dat mag hier
 * omdat het doel-id nooit uit gebruikersinvoer komt, maar altijd is
 * afgeleid van data die de aanroeper al legitiem mocht lezen (bv.
 * `event.ownerId`), en er alleen een e-mailadres/voornaam mee wordt
 * opgehaald — nooit geschreven. Dezelfde reden geldt voor de dagelijkse
 * herinnerings-cronjob (`app/api/cron/deadline-reminders/route.ts`), die
 * geen ingelogde gebruiker heeft en dus sowieso alleen via de
 * service-role bij de data kan.
 *
 * Geeft `null` terug als er geen SUPABASE_SERVICE_ROLE_KEY geconfigureerd
 * is. De aanroepende code valt dan terug op geen effect (admin-dashboard:
 * alleen eigen data; e-mail: gewoon niet verstuurd) totdat de sleutel gezet is.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isServiceRoleConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
