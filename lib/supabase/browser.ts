import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-client voor gebruik in Client Components (bv. het login-/
 * signup-formulier zelf, voor directe feedback zonder round-trip).
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase is niet geconfigureerd (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ontbreken).");
  }
  return createBrowserClient(url, anonKey);
}
