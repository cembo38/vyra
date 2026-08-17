import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Ververst de Supabase-sessie (auth-cookies) op elke request. Dit is
 * verplicht bij gebruik van @supabase/ssr: zonder dit loopt de sessie op
 * den duur vast omdat access tokens verlopen.
 *
 * Werkt zonder Supabase-configuratie: dan is dit een no-op en draait de
 * app gewoon door op de mock-auth (in-memory demo-store).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Belangrijk: dit ververst het token indien nodig (leest niets uit een
  // cache) en moet aangeroepen worden vóórdat je enige route-logica draait.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // "icon"/"apple-icon" erbij: sinds het favicon nu een gegenereerde route
  // is (app/icon.tsx) i.p.v. het statische favicon.ico, moet die net als
  // favicon.ico hier uitgezonderd worden — anders ververst elke favicon-
  // aanvraag (die browsers vaak sturen) onnodig de Supabase-sessie mee.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
