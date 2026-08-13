"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { AppNotification } from "@/lib/types";
import { markNotificationReadAction } from "@/lib/actions/misc-actions";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.round(hours / 24);
  return `${days} dag${days > 1 ? "en" : ""} geleden`;
}

export function NotificationsBell({ userId, notifications }: { userId: string; notifications: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaties"
        aria-expanded={open}
        className="bell-btn relative flex size-9 items-center justify-center rounded-full text-ink-soft transition-colors duration-[var(--duration-swift)] hover:bg-paper-dim hover:text-ink"
      >
        <Bell className="bell-icon size-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-2 items-center justify-center rounded-full bg-clay" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-line bg-white p-2 [box-shadow:var(--shadow-pop)]">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-medium text-ink">Notificaties</span>
            {unread > 0 && <span className="text-xs text-ink-faint">{unread} ongelezen</span>}
          </div>
          <div className="max-h-80 overflow-y-auto no-scrollbar">
            {notifications.length === 0 && <p className="px-2 py-6 text-center text-sm text-ink-faint">Nog geen notificaties.</p>}
            {notifications.slice(0, 8).map((n) => (
              <Link
                key={n.id}
                href={n.href ?? "#"}
                onClick={() => {
                  setOpen(false);
                  if (!n.read) startTransition(() => markNotificationReadAction(userId, n.id));
                }}
                className={cn("block rounded-xl px-2.5 py-2.5 text-sm transition-colors hover:bg-paper-dim", !n.read && "bg-sage-50/50")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink">{n.title}</p>
                  {!n.read && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-clay" />}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{n.body}</p>
                <p className="mt-1 text-[11px] text-ink-faint">{timeAgo(n.createdAt)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
