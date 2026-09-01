"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollFadeX } from "@/components/ui/ScrollFadeX";

export function EventSubNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;
  const tabs = [
    { href: base, label: "Overzicht", match: (p: string) => p === base },
    { href: `${base}/plan`, label: "Plan" },
    { href: `${base}/requests`, label: "Aanvragen", match: (p: string) => p.startsWith(`${base}/requests`) || p.startsWith(`${base}/offers`) },
    { href: `${base}/shortlist`, label: "Shortlist" },
    { href: `${base}/guests`, label: "Gasten" },
    { href: `${base}/gallery`, label: "Gastenfoto's" },
    { href: `${base}/budget`, label: "Budget" },
    { href: `${base}/timeline`, label: "Planning" },
    { href: `${base}/messages`, label: "Berichten" },
    { href: `${base}/settings`, label: "Instellingen" },
  ];

  return (
    <div className="border-b border-line bg-white">
      <ScrollFadeX variant="white" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 no-scrollbar">
        {tabs.map((tab) => {
          const active = tab.match ? tab.match(pathname) : pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative shrink-0 px-3.5 py-3.5 text-sm font-medium transition-colors duration-[var(--duration-swift)]",
                active ? "text-ink" : "nav-tab-hover text-ink-faint hover:text-ink-soft"
              )}
            >
              {tab.label}
              {active && <span className="absolute inset-x-3.5 -bottom-px h-0.5 rounded-full bg-clay" />}
            </Link>
          );
        })}
      </ScrollFadeX>
    </div>
  );
}
