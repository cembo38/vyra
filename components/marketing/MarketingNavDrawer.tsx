"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";

interface MarketingNavLink {
  href: string;
  label: string;
}

/**
 * Lichte mobiele-menuvariant voor de publieke marketingsite (`< md`) —
 * hergebruikt de generieke `Drawer`, maar zonder de permanente
 * rail/zijbalk-laag van `NavShell`: de publieke site heeft daar geen
 * behoefte aan, ook niet op iPad. Twee keer gebruikt (ingelogd/uitgelogd)
 * vanuit `HeaderAuthArea`, die toch al weet in welke staat de bezoeker is.
 */
export function MarketingNavDrawer({ links, footer }: { links: MarketingNavLink[]; footer: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu openen"
        aria-expanded={open}
        data-testid="marketing-drawer-trigger"
        className="icon-pop flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-paper-dim hover:text-ink md:hidden"
      >
        <Menu className="size-5" />
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} side="right" labelledBy="marketing-drawer-title" testId="marketing-drawer-panel">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <span id="marketing-drawer-title" className="font-display text-lg text-ink">Menu</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Menu sluiten"
            className="icon-pop flex size-11 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center rounded-xl px-3 text-[15px] font-medium text-ink-soft transition-colors duration-[var(--duration-swift)] hover:bg-paper-dim hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2.5 border-t border-line-soft px-5 py-4" onClick={() => setOpen(false)}>
          {footer}
        </div>
      </Drawer>
    </>
  );
}
