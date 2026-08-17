import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2", className)}>
      <span className={cn("flex size-8 items-center justify-center rounded-xl", dark ? "bg-white" : "bg-ink")}>
        <span className={cn("font-display text-lg italic", dark ? "text-ink" : "text-paper")}>V</span>
      </span>
      <span className={cn("font-display text-xl tracking-tight", dark ? "text-white" : "text-ink")}>Vyra</span>
    </Link>
  );
}

/** Alleen het merkje, zonder woordmerk — voor plekken waar de volledige Logo niet past, zoals de smalle 76px icoon-only zijbalk op iPad-portret. */
export function LogoMark({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <Link href="/" aria-label="Vyra — start" className={cn("group inline-flex items-center", className)}>
      <span className={cn("flex size-8 items-center justify-center rounded-xl", dark ? "bg-white" : "bg-ink")}>
        <span className={cn("font-display text-lg italic", dark ? "text-ink" : "text-paper")}>V</span>
      </span>
    </Link>
  );
}
