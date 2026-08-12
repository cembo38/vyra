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

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
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
