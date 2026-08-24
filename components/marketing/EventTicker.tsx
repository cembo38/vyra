import { EVENT_TYPE_LABELS } from "@/lib/types";

/**
 * "Bonus C — Tekstband" uit het "Vyra in Beweging"-voorstel (spec-item,
 * augustus 2026). Twee oneindig lopende stroken met alle evenementtypes,
 * tegengesteld aan elkaar — een rustige, ambient bevestiging dat Vyra voor
 * elk soort evenement is, tussen "Hoe het werkt" en de vertrouwensbalk in.
 * Puur CSS (`.motion-ticker` / `.motion-ticker-reverse` uit globals.css),
 * geen Framer Motion nodig; staat automatisch stil bij
 * `prefers-reduced-motion: reduce` (zie het blok onderaan globals.css).
 *
 * De inhoud van elke rij staat er twee keer achter elkaar (`[...ORDER,
 * ...ORDER]`) — de animatie schuift precies 50% op, dus de tweede helft
 * schuift naadloos in waar de eerste begon.
 */
const ORDER = Object.values(EVENT_TYPE_LABELS);

export function EventTicker() {
  return (
    <div aria-hidden="true" className="overflow-hidden border-y border-line-soft bg-paper py-6">
      <div className="flex w-fit motion-ticker">
        {[...ORDER, ...ORDER].map((label, i) => (
          <TickerChip key={`${label}-${i}`} label={label} />
        ))}
      </div>
      <div className="mt-3 flex w-fit motion-ticker motion-ticker-reverse">
        {[...ORDER, ...ORDER].reverse().map((label, i) => (
          <TickerChip key={`${label}-${i}`} label={label} muted />
        ))}
      </div>
    </div>
  );
}

function TickerChip({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={`mx-2 flex shrink-0 items-center rounded-full border px-4 py-1.5 text-sm whitespace-nowrap ${
        muted ? "border-line-soft text-ink-faint" : "border-line bg-white text-ink-soft [box-shadow:var(--shadow-card)]"
      }`}
    >
      {label}
    </span>
  );
}
