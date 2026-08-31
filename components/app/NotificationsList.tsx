"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { AppNotification } from "@/lib/types";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/misc-actions";
import { RealtimeRefresh } from "@/components/app/RealtimeRefresh";
import { NotificationContextBadge } from "@/components/ui/Badge";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
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

/**
 * Volledige notificatiepagina — het belletje in de nav toont alleen de
 * laatste 8 in een klein paneel (en dat paneel had bovendien een bug: in de
 * zijbalk-/drawer-footer klapte het naar beneden open en viel daardoor
 * (deels) buiten beeld, zie NotificationsBell.tsx). Deze pagina toont ALLE
 * notificaties, ongeacht die bug, en blijft dus ook werken als het paneel
 * om wat voor reden dan ook niet te zien/klikken is.
 */
export function NotificationsList({ userId, notifications }: { userId: string; notifications: AppNotification[] }) {
  const [pending, startTransition] = useTransition();
  const [markingAllId, setMarkingAllId] = useState(false);
  const router = useRouter();
  const unread = notifications.filter((n) => !n.read).length;

  function markOne(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(userId, id);
      router.refresh();
    });
  }

  function markAll() {
    setMarkingAllId(true);
    startTransition(async () => {
      await markAllNotificationsReadAction(userId);
      router.refresh();
      setMarkingAllId(false);
    });
  }

  return (
    <div>
      <RealtimeRefresh table="notifications" filter={`user_id=eq.${userId}`} event="INSERT" />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-faint">{unread > 0 ? `${unread} ongelezen` : "Alles gelezen"}</p>
        {unread > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={markAll}
            className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-sage/50 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
          >
            {markingAllId ? <VyraMarkSpinner className="text-sm" /> : <CheckCheck className="size-3.5" />}
            Alles markeren als gelezen
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">Nog geen notificaties.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const content = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink">{n.title}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-ink-faint">{timeAgo(n.createdAt)}</span>
                    {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-clay" />}
                  </div>
                </div>
                <p className="mt-1 text-sm text-ink-soft">{n.body}</p>
                <NotificationContextBadge href={n.href} className="mt-2" />
              </>
            );
            const className = cn(
              "block w-full rounded-xl border border-line-soft px-4 py-3 text-left text-sm transition-colors hover:bg-paper-dim",
              !n.read && "bg-sage-50/50"
            );
            return n.href ? (
              <Link key={n.id} href={n.href} onClick={() => !n.read && markOne(n.id)} className={className}>
                {content}
              </Link>
            ) : (
              <button key={n.id} type="button" onClick={() => !n.read && markOne(n.id)} className={className}>
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
