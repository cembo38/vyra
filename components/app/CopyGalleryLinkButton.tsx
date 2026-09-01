"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/** Kopieert de publieke gast-uploadlink van de gastenfoto-pagina naar het klembord — zelfde patroon als CopyRsvpLinkButton. */
export function CopyGalleryLinkButton({ uploadToken }: { uploadToken: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/gallery/${uploadToken}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Klembord niet beschikbaar (bv. onveilige context) — stil negeren.
        }
      }}
      className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20"
    >
      {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
      {copied ? "Link gekopieerd" : "Link kopiëren"}
    </button>
  );
}
