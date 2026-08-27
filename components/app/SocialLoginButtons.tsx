"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * "Inloggen met Google/Facebook/Apple" — het standaardblokje dat Cem vroeg
 * (na zijn video, aug. 2026). Gebruikt op zowel /login als /signup: bij
 * Supabase Auth is er geen technisch onderscheid tussen "inloggen" en
 * "registreren" via OAuth — signInWithOAuth() doet allebei tegelijk (nieuw
 * account als het e-mailadres nog niet bestaat, anders gewoon inloggen).
 * De echte rol-/naamkeuze (organisator/leverancier, voor-/achternaam) kan
 * niet vooraf gevraagd worden zoals bij het gewone formulier — die vraagt
 * /onboarding/page.tsx achteraf op, via de bestaande needsOnboarding-check
 * in app/auth/callback/route.ts (die precies hetzelfde codepad gebruikt als
 * de e-mail-magic-link-flow, dus hier is verder niets aan te passen).
 *
 * Client Component omdat signInWithOAuth() zelf de browser moet
 * doorsturen naar de provider — dat kan niet vanuit een Server Action.
 */
type Provider = "google" | "facebook" | "apple";

const PROVIDERS: { id: Provider; label: string; icon: React.ReactNode }[] = [
  { id: "google", label: "Google", icon: <GoogleIcon /> },
  { id: "facebook", label: "Facebook", icon: <FacebookIcon /> },
  { id: "apple", label: "Apple", icon: <AppleIcon /> },
];

export function SocialLoginButtons() {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(provider: Provider) {
    setError(null);
    setPending(provider);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      // Bij succes stuurt Supabase de browser meteen door naar de provider
      // (Google/Facebook/Apple) — deze regel wordt dan niet meer bereikt.
      // Alleen bij een configuratiefout (bv. provider nog niet aangezet in
      // Supabase) komen we hier terecht.
      if (oauthError) {
        setError("Dit is niet gelukt. Probeer het opnieuw, of log in met je e-mailadres.");
        setPending(null);
      }
    } catch {
      setError("Dit is niet gelukt. Probeer het opnieuw, of log in met je e-mailadres.");
      setPending(null);
    }
  }

  return (
    <div>
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">of</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">{error}</div>
      )}

      <div className="space-y-2.5">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleClick(p.id)}
            disabled={pending !== null}
            className="lift-hover flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white py-2.5 text-sm font-medium text-ink hover:bg-paper-dim disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === p.id ? <Loader2 className="size-4 animate-spin" /> : p.icon}
            Ga verder met {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.41 3.63v3h3.9c2.28-2.1 3.6-5.2 3.6-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.9-3c-1.08.73-2.46 1.16-4.05 1.16-3.11 0-5.75-2.1-6.69-4.92H1.28v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.31 14.33A7.2 7.2 0 0 1 4.93 12c0-.81.14-1.6.38-2.33V6.58H1.28A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.28 5.42l4.03-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.58l4.03 3.09C6.25 6.85 8.89 4.75 12 4.75z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.7 18.63.5 12 .5S0 5.7 0 12.07C0 17.82 4.39 22.6 10.13 23.5v-8.05H7.08v-3.38h3.05V9.41c0-2.98 1.8-4.63 4.55-4.63 1.32 0 2.7.23 2.7.23v2.91h-1.52c-1.5 0-1.97.92-1.97 1.87v2.28h3.36l-.54 3.38h-2.82V23.5C19.61 22.6 24 17.82 24 12.07z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.36 1.01c.1 1.13-.31 2.24-.98 3.06-.7.83-1.85 1.48-2.96 1.4-.13-1.1.35-2.24 1-2.96.72-.8 1.98-1.4 2.94-1.5zM20.4 17.6c-.5 1.15-.74 1.66-1.38 2.68-.9 1.42-2.16 3.19-3.73 3.2-1.4.02-1.76-.91-3.65-.9-1.9.01-2.29.92-3.69.9-1.57-.02-2.76-1.61-3.66-3.03C1.68 17.5.9 13.83 2.2 11.3c.9-1.74 2.52-2.85 4.28-2.87 1.44-.03 2.8.97 3.68.97.87 0 2.52-1.2 4.25-1.02.72.03 2.75.29 4.05 2.2-.1.07-2.42 1.41-2.39 4.21.03 3.34 2.93 4.45 2.96 4.46.03.02-.46 1.57-1.5 3.35z" />
    </svg>
  );
}
