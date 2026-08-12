import { cn } from "@/lib/utils";
import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/90 shadow-sm",
  secondary: "bg-coral text-white hover:bg-coral-dark shadow-sm",
  outline: "border border-line bg-white text-ink hover:border-ink/40 hover:bg-paper-dim",
  ghost: "text-ink-soft hover:text-ink hover:bg-paper-dim",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3.5 py-1.5 rounded-full gap-1.5",
  md: "text-sm px-5 py-2.5 rounded-full gap-2",
  lg: "text-base px-7 py-3.5 rounded-full gap-2.5",
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
        "inline-flex items-center justify-center font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
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
}

export function LinkButton({ variant = "primary", size = "md", children, className, icon, iconRight, fullWidth, href, target }: LinkButtonProps) {
  return (
    <Link
      href={href}
      target={target}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98]",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
    >
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}
