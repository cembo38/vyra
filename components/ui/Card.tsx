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
        "card-hover rounded-2xl border border-line bg-white p-6 hover:border-clay/40 [box-shadow:var(--shadow-card)]",
        className
      )}
      {...props}
    />
  );
}
