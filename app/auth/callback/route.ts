import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Wisselt de magic-link-code (die Supabase per e-mail stuurt) om voor een
 * echte sessie, en stuurt de gebruiker daarna door naar zijn evenementen
 * (of naar onboarding als het profiel nog leeg is).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Alleen gebruikt door de "wachtwoord vergeten"-link (zie
  // requestPasswordResetAction) om na het omwisselen van de code niet de
  // gewone profiel-gebaseerde redirect hieronder te doorlopen, maar direct
  // naar de "nieuw wachtwoord instellen"-pagina te gaan. De check op een
  // leidende "/" voorkomt dat dit param misbruikt wordt voor een redirect
  // naar een externe site.
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        if (next && next.startsWith("/")) return NextResponse.redirect(`${origin}${next}`);

        const { data: profile } = await supabase.from("profiles").select("first_name, role").eq("id", data.user.id).single();

        // Iemand kan zowel organisator als leverancier zijn ("both"). We
        // sturen die eerst naar het leveranciersprofiel als dat nog moet
        // worden ingericht (dat is verplicht om als leverancier verder te
        // kunnen), en anders naar de evenementen — de leveranciersportaal
        // blijft altijd bereikbaar via de navigatie.
        if (profile?.role === "supplier" || profile?.role === "both") {
          const { data: supplierRow } = await supabase.from("suppliers").select("id").eq("owner_id", data.user.id).maybeSingle();
          if (!supplierRow) return NextResponse.redirect(`${origin}/supplier/onboarding`);
          if (profile.role === "supplier") return NextResponse.redirect(`${origin}/supplier/dashboard`);
        }

        const needsOnboarding = !profile?.first_name;
        return NextResponse.redirect(`${origin}${needsOnboarding ? "/onboarding" : "/events"}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=1`);
}
