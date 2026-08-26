"use client";

import { useState } from "react";
import { Check, Copy, Users } from "lucide-react";

/**
 * "Referral-programma" (livegang-audit) — de link zelf is simpelweg
 * `/signup?ref=<userId>` (gevalideerd server-side bij aanmelden, zie
 * handle_new_user() in migratie 0045), dus dit component heeft geen eigen
 * server action nodig — alleen een kopieerknop rond een kant-en-klare URL.
 */
export function ReferralSection({ referralUrl, referralCount, showSpotlightNote }: { referralUrl: string; referralCount: number; showSpotlightNote: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard-API kan falen (bv. geen HTTPS, oude browser) — de link
      // staat gewoon zichtbaar in het tekstveld, dus handmatig selecteren
      // blijft altijd mogelijk.
    }
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm text-ink-soft">
        <Users className="size-4 shrink-0 text-sage" />
        Nodig collega&apos;s of vrienden uit — {referralCount > 0 ? <>al <strong>{referralCount}</strong> aanmelding{referralCount !== 1 ? "en" : ""} via jou.</> : "je eerste aanmelding levert meteen een bonus op."}
        {showSpotlightNote && " Elke aanmelding via jouw link levert je een gratis spotlight-boost op."}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          readOnly
          value={referralUrl}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 truncate rounded-xl border border-line bg-paper-dim px-3 py-2 text-sm text-ink-soft"
        />
        <button
          type="button"
          onClick={copy}
          className="chip-hover flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:border-sage/50"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? "Gekopieerd" : "Kopiëren"}
        </button>
      </div>
    </div>
  );
}
