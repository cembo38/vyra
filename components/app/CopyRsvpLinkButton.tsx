"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/** Kopieert de publieke RSVP-link voor deze gast (geen login vereist) naar het klembord, zodat de organisator hem zelf kan versturen via WhatsApp/mail. */
export function CopyRsvpLinkButton({ guestId }: { guestId: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/rsvp/${guestId}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Klembord niet beschikbaar (bv. onveilige context) — stil negeren.
        }
      }}
      className="icon-pop flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:border-clay/50 hover:text-ink"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Link2 className="size-3.5" />}
      {copied ? "Gekopieerd" : "RSVP-link"}
    </button>
  );
}
