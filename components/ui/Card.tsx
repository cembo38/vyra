import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-white p-6 [box-shadow:var(--shadow-card)]", className)}
      {...props}
    />
  );
}

export function CardHover({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 [box-shadow:var(--shadow-card)] hover:[box-shadow:var(--shadow-card-hover)]",
        className
      )}
      {...props}
    />
  );
}
