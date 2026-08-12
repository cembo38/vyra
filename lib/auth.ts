import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data/store";
import { UserAccount } from "@/lib/types";

/**
 * Echte authenticatie via Supabase Auth (magic link per e-mail — geen
 * wachtwoord nodig). `getCurrentUser()` geeft `null` terug als niemand is
 * ingelogd; de callers (layouts/pages) sturen dan door naar /login.
 */
export async function getCurrentUser(): Promise<UserAccount | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return getUser(user.id);
}

/**
 * Stuurt een magic link naar het opgegeven e-mailadres. Als er nog geen
 * account bestaat, maakt Supabase Auth er automatisch één aan (de
 * database-trigger `handle_new_user` maakt dan meteen het bijbehorende
 * profiel aan — zie supabase/migrations/0001_init.sql).
 */
export async function sendMagicLink(email: string, redirectTo: string, extra?: { firstName?: string; lastName?: string }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is niet geconfigureerd. Zet NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      data: { first_name: extra?.firstName ?? "", last_name: extra?.lastName ?? "" },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}
