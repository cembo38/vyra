"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

function getParts(deadlineIso: string) {
  const diff = new Date(deadlineIso).getTime() - Date.now();
  const expired = diff <= 0;
  const totalMinutes = Math.max(0, Math.floor(diff / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { expired, hours, minutes };
}

export function DeadlineCountdown({ deadlineIso, className }: { deadlineIso: string; className?: string }) {
  const [parts, setParts] = useState(() => getParts(deadlineIso));

  useEffect(() => {
    const id = setInterval(() => setParts(getParts(deadlineIso)), 30000);
    return () => clearInterval(id);
  }, [deadlineIso]);

  if (parts.expired) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-ink-faint", className)}>
        <Clock className="size-3.5" /> Deadline verstreken
      </span>
    );
  }

  const urgent = parts.hours < 6;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", urgent ? "text-danger" : "text-warning", className)}>
      <Clock className="size-3.5" />
      Nog {parts.hours} uur {parts.minutes} min om te reageren
    </span>
  );
}

export function EventCountdown({ dateIso, className }: { dateIso: string | null; className?: string }) {
  if (!dateIso) {
    return <span className={cn("text-sm text-ink-faint", className)}>Datum nog niet bepaald</span>;
  }
  const target = new Date(dateIso + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) return <span className={cn("text-sm text-ink-faint", className)}>Evenement was {Math.abs(days)} dagen geleden</span>;
  if (days === 0) return <span className={cn("text-sm font-semibold text-clay", className)}>Het is vandaag! 🎉</span>;
  return (
    <span className={cn("text-sm text-ink-soft", className)}>
      Nog <span className="font-semibold text-ink">{days}</span> {days === 1 ? "dag" : "dagen"}
    </span>
  );
}
