import { cn } from "@/lib/utils";

export function ProgressBar({ value, className, tone = "ink" }: { value: number; className?: string; tone?: "ink" | "clay" | "sage" | "success" | "warning" | "danger" }) {
  const toneClass: Record<string, string> = {
    ink: "bg-ink",
    clay: "bg-clay",
    sage: "bg-sage",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  };
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-paper-dim", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", toneClass[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function ReadinessRing({ value, size = 64 }: { value: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;
  const color = value >= 75 ? "var(--color-success)" : value >= 45 ? "var(--color-ochre)" : "var(--color-clay)";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--color-line)" strokeWidth={6} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <span className="absolute text-sm font-semibold text-ink">{value}%</span>
    </div>
  );
}
