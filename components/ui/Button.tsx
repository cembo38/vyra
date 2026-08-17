import { cn } from "@/lib/utils";
import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/90 shadow-sm hover:[box-shadow:var(--shadow-card-hover)]",
  secondary: "bg-clay text-white hover:bg-clay-dark shadow-sm hover:[box-shadow:var(--shadow-card-hover)]",
  outline: "border border-line bg-white text-ink hover:border-ink/40 hover:bg-paper-dim",
  ghost: "text-ink-soft hover:text-ink hover:bg-paper-dim",
  danger: "bg-danger text-white hover:opacity-90",
};

/**
 * `md` (het meest gebruikte formaat, ook de default) is bewust ~44px hoog
 * — de aanbevolen minimale tikgrootte voor mobiel (Apple HIG/Material).
 * `sm` blijft daaronder (~36px): die wordt gebruikt in dichte/secundaire
 * contexten (naast chips, in rijen met meerdere acties) waar alles naar
 * 44px optrekken juist een te-vol/"knoppen te groot"-gevoel zou geven.
 */
const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3.5 py-2 rounded-xl gap-1.5",
  md: "text-sm px-5 py-3 rounded-xl gap-2",
  lg: "text-base px-7 py-3.5 rounded-xl gap-2.5",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", size = "md", children, className, icon, iconRight, fullWidth, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-[var(--duration-swift)] ease-[var(--ease-swift)] hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0 active:scale-[0.98] active:translate-y-0",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

interface LinkButtonProps extends CommonProps {
  href: string;
  target?: string;
  /**
   * Toont standaard alleen het icoon; de tekst verschijnt pas als
   * uitklappend label bij hover (zie `.expand-hover` in globals.css) — op
   * apparaten zonder hover (touchscreens) blijft de tekst gewoon altijd
   * zichtbaar. `icon` is in die combinatie verplicht om zinnig te zijn.
   */
  expandOnHover?: boolean;
  ariaLabel?: string;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  children,
  className,
  icon,
  iconRight,
  fullWidth,
  href,
  target,
  expandOnHover,
  ariaLabel,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      target={target}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-[var(--duration-swift)] ease-[var(--ease-swift)] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0",
        expandOnHover && "expand-hover",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
    >
      {icon}
      {expandOnHover ? (
        <span className="expand-hover-label">
          <span className="expand-hover-label-inner">{children}</span>
        </span>
      ) : (
        children
      )}
      {iconRight}
    </Link>
  );
}
