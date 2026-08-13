import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase-client — omzeilt Row Level Security volledig.
 *
 * ALLEEN gebruiken binnen /admin (en pas ná de ADMIN_EMAILS-check), nooit
 * voor gewone gebruikersacties en nooit client-side (vandaar de
 * "server-only" import bovenaan, die een build-fout geeft als dit bestand
 * per ongeluk in client-code terechtkomt).
 *
 * Geeft `null` terug als er geen SUPABASE_SERVICE_ROLE_KEY geconfigureerd
 * is. De aanroepende code valt dan terug op de gewone (RLS-beperkte)
 * client, zodat het admin-dashboard blijft werken — met alleen de data van
 * de ingelogde beheerder zelf — totdat de sleutel gezet is.
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
