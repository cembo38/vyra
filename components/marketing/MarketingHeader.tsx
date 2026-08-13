import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/marketing/Logo";
import { HeaderAuthArea, HeaderAuthAreaFallback } from "@/components/marketing/HeaderAuthArea";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-soft md:flex">
          <Link href="/#hoe-het-werkt" className="hover:text-ink">Hoe het werkt</Link>
          <Link href="/#evenementen" className="hover:text-ink">Voor elk evenement</Link>
          <Link href="/supplier" className="hover:text-ink">Voor leveranciers</Link>
        </nav>
        <Suspense fallback={<HeaderAuthAreaFallback />}>
          <HeaderAuthArea />
        </Suspense>
      </div>
    </header>
  );
}
