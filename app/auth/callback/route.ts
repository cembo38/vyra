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
        const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", data.user.id).single();
        const needsOnboarding = !profile?.first_name;
        return NextResponse.redirect(`${origin}${needsOnboarding ? "/onboarding" : "/events"}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=1`);
}
