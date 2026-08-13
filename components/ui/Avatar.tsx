import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export function SupplierAvatar({
  gradient,
  initials,
  imageUrl,
  size = 48,
  verified,
  className,
}: {
  gradient: [string, string];
  initials: string;
  imageUrl?: string | null;
  size?: number;
  verified?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full rounded-2xl object-cover shadow-inner"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-2xl font-display text-white shadow-inner"
          style={{
            background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
            fontSize: size * 0.36,
          }}
        >
          {initials}
        </div>
      )}
      {verified && (
        <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 shadow">
          <CheckCircle2 className="size-4 text-violet fill-violet text-white" />
        </div>
      )}
    </div>
  );
}

export function UserAvatar({ firstName, lastName, color, size = 36 }: { firstName: string; lastName: string; color: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
    >
      {(firstName[0] ?? "").toUpperCase()}
      {(lastName[0] ?? "").toUpperCase()}
    </div>
  );
}
