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

export function NotificationsBell({
  userId,
  notifications,
  align = "right",
}: {
  userId: string;
  notifications: AppNotification[];
  /** Aan welke kant het paneel opent — "left" voor gebruik in een zijbalk-footer die tegen de linkerrand van het scherm zit. */
  align?: "left" | "right";
}) {
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

  // Sluit dit paneel zodra ergens anders een drawer opent (zie
  // `components/ui/Drawer.tsx`) — voorkomt dat dit paneel op mobiel
  // achter een net-geopende drawer blijft "doorschemeren".
  useEffect(() => {
    function onOtherOverlayOpen() {
      setOpen(false);
    }
    window.addEventListener("vyra:overlay-open", onOtherOverlayOpen);
    return () => window.removeEventListener("vyra:overlay-open", onOtherOverlayOpen);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaties"
        aria-expanded={open}
        className="bell-btn relative flex size-11 items-center justify-center rounded-full text-ink-soft transition-colors duration-[var(--duration-swift)] hover:bg-paper-dim hover:text-ink"
      >
        <Bell className="bell-icon size-5" />
        {unread > 0 && (
          <span className="absolute right-2 top-2 flex size-2 items-center justify-center rounded-full bg-clay" />
        )}
      </button>
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-white p-2 [box-shadow:var(--shadow-pop)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-medium text-ink">Notificaties</span>
            {unread > 0 && <span className="text-xs text-ink-faint">{unread} ongelezen</span>}
          </div>
          <div className="max-h-[min(20rem,70vh)] overflow-y-auto no-scrollbar">
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
