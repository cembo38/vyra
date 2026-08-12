import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase-client voor gebruik in Server Components, Server Actions en
 * Route Handlers. Leest/schrijft de sessie via Next.js cookies, zodat
 * `auth.uid()` in Postgres Row Level Security-policies correct werkt.
 *
 * Geeft `null` terug als er geen Supabase-project is geconfigureerd (nog
 * geen NEXT_PUBLIC_SUPABASE_URL/ANON_KEY in .env.local) — de rest van de
 * app valt dan terug op de in-memory demo-store, zodat de app blijft
 * werken zolang Supabase nog niet is aangesloten.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components mogen geen cookies zetten; proxy.ts ververst
          // de sessie in dat geval. Veilig te negeren.
        }
      },
    },
  });
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
